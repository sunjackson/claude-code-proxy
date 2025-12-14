/**
 * Terminal Session Service
 *
 * 终端会话持久化服务，负责将 PTY 会话元数据持久化到数据库
 * 提供会话的 CRUD 操作、历史记录管理和命令审计功能
 */

use crate::db::DbPool;
use crate::models::error::{AppError, AppResult};
use crate::models::terminal_session::{
    CommandAuditLog, NewTerminalSession, SessionHistory, TerminalSession,
};
use rusqlite::params;

/// 终端会话服务
pub struct TerminalSessionService {
    pool: DbPool,
}

impl TerminalSessionService {
    /// 创建新的终端会话服务实例
    pub fn new(pool: DbPool) -> Self {
        Self { pool }
    }

    /// 创建新会话记录
    ///
    /// # Arguments
    /// * `session` - 新会话数据
    ///
    /// # Returns
    /// 返回新创建的会话数据库 ID
    pub async fn create_session(&self, session: NewTerminalSession) -> AppResult<i64> {
        let pool = self.pool.clone();

        tokio::task::spawn_blocking(move || {
            let conn_arc = pool.get_connection();
            let conn = conn_arc.lock().unwrap();

            let id = conn.query_row(
                "INSERT INTO TerminalSession (
                    session_id, config_id, name, work_dir,
                    is_claude_code, claude_options, rows, cols
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
                RETURNING id",
                params![
                    session.session_id,
                    session.config_id,
                    session.name,
                    session.work_dir,
                    session.is_claude_code,
                    session.claude_options,
                    session.rows,
                    session.cols,
                ],
                |row| row.get(0),
            )
            .map_err(|e| AppError::DatabaseError {
                message: format!("创建会话失败: {}", e),
            })?;

            log::info!("创建终端会话记录: session_id={}, db_id={}", session.session_id, id);
            Ok(id)
        })
        .await
        .map_err(|e| AppError::DatabaseError {
            message: format!("创建会话任务失败: {}", e),
        })?
    }

    /// 更新会话的最后使用时间
    ///
    /// # Arguments
    /// * `session_id` - 会话 ID
    pub async fn update_last_used(&self, session_id: &str) -> AppResult<()> {
        let pool = self.pool.clone();
        let session_id = session_id.to_string();

        tokio::task::spawn_blocking(move || {
            let conn_arc = pool.get_connection();
            let conn = conn_arc.lock().unwrap();
            let updated = conn
                .execute(
                    "UPDATE TerminalSession SET last_used_at = CURRENT_TIMESTAMP WHERE session_id = ?1",
                    params![session_id],
                )
                .map_err(|e| AppError::DatabaseError {
                    message: format!("更新最后使用时间失败: {}", e),
                })?;

            if updated == 0 {
                log::warn!("未找到会话: {}", session_id);
            }

            Ok(())
        })
        .await
        .map_err(|e| AppError::DatabaseError {
            message: format!("更新最后使用时间任务失败: {}", e),
        })?
    }

    /// 更新会话运行状态
    ///
    /// # Arguments
    /// * `session_id` - 会话 ID
    /// * `running` - 运行状态
    pub async fn update_running_status(&self, session_id: &str, running: bool) -> AppResult<()> {
        let pool = self.pool.clone();
        let session_id = session_id.to_string();

        tokio::task::spawn_blocking(move || {
            let conn_arc = pool.get_connection();
            let conn = conn_arc.lock().unwrap();
            conn.execute(
                "UPDATE TerminalSession SET running = ?1 WHERE session_id = ?2",
                params![running, session_id],
            )
            .map_err(|e| AppError::DatabaseError {
                message: format!("更新运行状态失败: {}", e),
            })?;

            Ok(())
        })
        .await
        .map_err(|e| AppError::DatabaseError {
            message: format!("更新运行状态任务失败: {}", e),
        })?
    }

    /// 更新会话终端尺寸
    ///
    /// # Arguments
    /// * `session_id` - 会话 ID
    /// * `rows` - 行数
    /// * `cols` - 列数
    pub async fn update_terminal_size(&self, session_id: &str, rows: i32, cols: i32) -> AppResult<()> {
        let pool = self.pool.clone();
        let session_id = session_id.to_string();

        tokio::task::spawn_blocking(move || {
            let conn_arc = pool.get_connection();
            let conn = conn_arc.lock().unwrap();
            conn.execute(
                "UPDATE TerminalSession SET rows = ?1, cols = ?2 WHERE session_id = ?3",
                params![rows, cols, session_id],
            )
            .map_err(|e| AppError::DatabaseError {
                message: format!("更新终端尺寸失败: {}", e),
            })?;

            Ok(())
        })
        .await
        .map_err(|e| AppError::DatabaseError {
            message: format!("更新终端尺寸任务失败: {}", e),
        })?
    }

    /// 关闭会话并记录退出信息
    ///
    /// # Arguments
    /// * `session_id` - 会话 ID
    /// * `exit_code` - 退出码（可选）
    pub async fn close_session(&self, session_id: &str, exit_code: Option<i32>) -> AppResult<()> {
        let pool = self.pool.clone();
        let session_id = session_id.to_string();

        tokio::task::spawn_blocking(move || {
            let conn_arc = pool.get_connection();
            let conn = conn_arc.lock().unwrap();
            conn.execute(
                "UPDATE TerminalSession
                 SET running = 0, closed_at = CURRENT_TIMESTAMP
                 WHERE session_id = ?1",
                params![session_id],
            )
            .map_err(|e| AppError::DatabaseError {
                message: format!("关闭会话失败: {}", e),
            })?;

            log::info!("关闭终端会话: session_id={}, exit_code={:?}", session_id, exit_code);
            Ok(())
        })
        .await
        .map_err(|e| AppError::DatabaseError {
            message: format!("关闭会话任务失败: {}", e),
        })?
    }

    /// 将会话移动到历史记录
    ///
    /// # Arguments
    /// * `session_id` - 会话 ID
    /// * `exit_code` - 退出码（可选）
    pub async fn move_to_history(&self, session_id: &str, exit_code: Option<i32>) -> AppResult<()> {
        let pool = self.pool.clone();
        let session_id = session_id.to_string();

        tokio::task::spawn_blocking(move || {
            let conn_arc = pool.get_connection();
            let conn = conn_arc.lock().unwrap();
            // 读取会话信息
            let session: Option<TerminalSession> = conn
                .query_row(
                    "SELECT id, session_id, config_id, name, work_dir,
                            created_at, last_used_at, closed_at,
                            is_claude_code, claude_options, running, rows, cols
                     FROM TerminalSession
                     WHERE session_id = ?1",
                    params![session_id],
                    |row| {
                        Ok(TerminalSession {
                            id: row.get(0)?,
                            session_id: row.get(1)?,
                            config_id: row.get(2)?,
                            name: row.get(3)?,
                            work_dir: row.get(4)?,
                            created_at: row.get(5)?,
                            last_used_at: row.get(6)?,
                            closed_at: row.get(7)?,
                            is_claude_code: row.get(8)?,
                            claude_options: row.get(9)?,
                            running: row.get(10)?,
                            rows: row.get(11)?,
                            cols: row.get(12)?,
                        })
                    },
                )
                .ok();

            if let Some(session) = session {
                // 插入历史记录
                let exited_normally = exit_code == Some(0) || exit_code.is_none();

                conn.execute(
                    "INSERT INTO SessionHistory (
                        session_id, config_id, name, work_dir,
                        created_at, closed_at, exit_code, exited_normally
                    ) VALUES (?1, ?2, ?3, ?4, ?5, CURRENT_TIMESTAMP, ?6, ?7)",
                    params![
                        session.session_id,
                        session.config_id,
                        session.name,
                        session.work_dir,
                        session.created_at,
                        exit_code,
                        exited_normally,
                    ],
                )
                .map_err(|e| AppError::DatabaseError {
                    message: format!("插入历史记录失败: {}", e),
                })?;

                // 删除活跃会话记录
                conn.execute(
                    "DELETE FROM TerminalSession WHERE session_id = ?1",
                    params![session_id],
                )
                .map_err(|e| AppError::DatabaseError {
                    message: format!("删除会话记录失败: {}", e),
                })?;

                log::info!("会话已归档到历史记录: session_id={}", session_id);
            }

            Ok(())
        })
        .await
        .map_err(|e| AppError::DatabaseError {
            message: format!("归档会话任务失败: {}", e),
        })?
    }

    /// 获取活跃会话列表
    pub async fn get_active_sessions(&self) -> AppResult<Vec<TerminalSession>> {
        let pool = self.pool.clone();

        tokio::task::spawn_blocking(move || {
            let conn_arc = pool.get_connection();
            let conn = conn_arc.lock().unwrap();
            let mut stmt = conn
                .prepare(
                    "SELECT id, session_id, config_id, name, work_dir,
                            created_at, last_used_at, closed_at,
                            is_claude_code, claude_options, running, rows, cols
                     FROM TerminalSession
                     WHERE running = 1
                     ORDER BY last_used_at DESC",
                )
                .map_err(|e| AppError::DatabaseError {
                    message: format!("准备查询失败: {}", e),
                })?;

            let sessions = stmt
                .query_map([], |row| {
                    Ok(TerminalSession {
                        id: row.get(0)?,
                        session_id: row.get(1)?,
                        config_id: row.get(2)?,
                        name: row.get(3)?,
                        work_dir: row.get(4)?,
                        created_at: row.get(5)?,
                        last_used_at: row.get(6)?,
                        closed_at: row.get(7)?,
                        is_claude_code: row.get(8)?,
                        claude_options: row.get(9)?,
                        running: row.get(10)?,
                        rows: row.get(11)?,
                        cols: row.get(12)?,
                    })
                })
                .map_err(|e| AppError::DatabaseError {
                    message: format!("查询会话失败: {}", e),
                })?
                .collect::<Result<Vec<_>, _>>()
                .map_err(|e| AppError::DatabaseError {
                    message: format!("读取会话数据失败: {}", e),
                })?;

            Ok(sessions)
        })
        .await
        .map_err(|e| AppError::DatabaseError {
            message: format!("查询活跃会话任务失败: {}", e),
        })?
    }

    /// 获取所有会话（包括已关闭）
    pub async fn get_all_sessions(&self) -> AppResult<Vec<TerminalSession>> {
        let pool = self.pool.clone();

        tokio::task::spawn_blocking(move || {
            let conn_arc = pool.get_connection();
            let conn = conn_arc.lock().unwrap();
            let mut stmt = conn
                .prepare(
                    "SELECT id, session_id, config_id, name, work_dir,
                            created_at, last_used_at, closed_at,
                            is_claude_code, claude_options, running, rows, cols
                     FROM TerminalSession
                     ORDER BY last_used_at DESC",
                )
                .map_err(|e| AppError::DatabaseError {
                    message: format!("准备查询失败: {}", e),
                })?;

            let sessions = stmt
                .query_map([], |row| {
                    Ok(TerminalSession {
                        id: row.get(0)?,
                        session_id: row.get(1)?,
                        config_id: row.get(2)?,
                        name: row.get(3)?,
                        work_dir: row.get(4)?,
                        created_at: row.get(5)?,
                        last_used_at: row.get(6)?,
                        closed_at: row.get(7)?,
                        is_claude_code: row.get(8)?,
                        claude_options: row.get(9)?,
                        running: row.get(10)?,
                        rows: row.get(11)?,
                        cols: row.get(12)?,
                    })
                })
                .map_err(|e| AppError::DatabaseError {
                    message: format!("查询会话失败: {}", e),
                })?
                .collect::<Result<Vec<_>, _>>()
                .map_err(|e| AppError::DatabaseError {
                    message: format!("读取会话数据失败: {}", e),
                })?;

            Ok(sessions)
        })
        .await
        .map_err(|e| AppError::DatabaseError {
            message: format!("查询所有会话任务失败: {}", e),
        })?
    }

    /// 根据 session_id 获取会话
    pub async fn get_session(&self, session_id: &str) -> AppResult<Option<TerminalSession>> {
        let pool = self.pool.clone();
        let session_id = session_id.to_string();

        tokio::task::spawn_blocking(move || {
            let conn_arc = pool.get_connection();
            let conn = conn_arc.lock().unwrap();
            let session = conn
                .query_row(
                    "SELECT id, session_id, config_id, name, work_dir,
                            created_at, last_used_at, closed_at,
                            is_claude_code, claude_options, running, rows, cols
                     FROM TerminalSession
                     WHERE session_id = ?1",
                    params![session_id],
                    |row| {
                        Ok(TerminalSession {
                            id: row.get(0)?,
                            session_id: row.get(1)?,
                            config_id: row.get(2)?,
                            name: row.get(3)?,
                            work_dir: row.get(4)?,
                            created_at: row.get(5)?,
                            last_used_at: row.get(6)?,
                            closed_at: row.get(7)?,
                            is_claude_code: row.get(8)?,
                            claude_options: row.get(9)?,
                            running: row.get(10)?,
                            rows: row.get(11)?,
                            cols: row.get(12)?,
                        })
                    },
                )
                .ok();

            Ok(session)
        })
        .await
        .map_err(|e| AppError::DatabaseError {
            message: format!("查询会话任务失败: {}", e),
        })?
    }

    /// 获取会话历史记录
    ///
    /// # Arguments
    /// * `limit` - 限制返回数量（可选）
    pub async fn get_session_history(&self, limit: Option<i32>) -> AppResult<Vec<SessionHistory>> {
        let pool = self.pool.clone();

        tokio::task::spawn_blocking(move || {
            let conn_arc = pool.get_connection();
            let conn = conn_arc.lock().unwrap();
            let query = if let Some(limit) = limit {
                format!(
                    "SELECT id, session_id, config_id, name, work_dir,
                            created_at, closed_at, exit_code, exited_normally
                     FROM SessionHistory
                     ORDER BY closed_at DESC
                     LIMIT {}",
                    limit
                )
            } else {
                "SELECT id, session_id, config_id, name, work_dir,
                        created_at, closed_at, exit_code, exited_normally
                 FROM SessionHistory
                 ORDER BY closed_at DESC"
                    .to_string()
            };

            let mut stmt = conn.prepare(&query).map_err(|e| AppError::DatabaseError {
                message: format!("准备查询失败: {}", e),
            })?;

            let history = stmt
                .query_map([], |row| {
                    Ok(SessionHistory {
                        id: row.get(0)?,
                        session_id: row.get(1)?,
                        config_id: row.get(2)?,
                        name: row.get(3)?,
                        work_dir: row.get(4)?,
                        created_at: row.get(5)?,
                        closed_at: row.get(6)?,
                        exit_code: row.get(7)?,
                        exited_normally: row.get(8)?,
                    })
                })
                .map_err(|e| AppError::DatabaseError {
                    message: format!("查询历史记录失败: {}", e),
                })?
                .collect::<Result<Vec<_>, _>>()
                .map_err(|e| AppError::DatabaseError {
                    message: format!("读取历史记录数据失败: {}", e),
                })?;

            Ok(history)
        })
        .await
        .map_err(|e| AppError::DatabaseError {
            message: format!("查询历史记录任务失败: {}", e),
        })?
    }

    /// 记录命令审计日志
    ///
    /// # Arguments
    /// * `session_id` - 会话 ID
    /// * `command` - 执行的命令
    /// * `allowed` - 是否允许执行
    pub async fn log_command(&self, session_id: &str, command: &str, allowed: bool) -> AppResult<()> {
        let pool = self.pool.clone();
        let session_id = session_id.to_string();
        let command = command.to_string();

        tokio::task::spawn_blocking(move || {
            let conn_arc = pool.get_connection();
            let conn = conn_arc.lock().unwrap();
            conn.execute(
                "INSERT INTO CommandAuditLog (session_id, command, allowed)
                 VALUES (?1, ?2, ?3)",
                params![session_id, command, allowed],
            )
            .map_err(|e| AppError::DatabaseError {
                message: format!("记录命令审计失败: {}", e),
            })?;

            Ok(())
        })
        .await
        .map_err(|e| AppError::DatabaseError {
            message: format!("记录命令审计任务失败: {}", e),
        })?
    }

    /// 获取会话的命令审计日志
    ///
    /// # Arguments
    /// * `session_id` - 会话 ID
    /// * `limit` - 限制返回数量（可选）
    pub async fn get_command_logs(
        &self,
        session_id: &str,
        limit: Option<i32>,
    ) -> AppResult<Vec<CommandAuditLog>> {
        let pool = self.pool.clone();
        let session_id = session_id.to_string();

        tokio::task::spawn_blocking(move || {
            let conn_arc = pool.get_connection();
            let conn = conn_arc.lock().unwrap();
            let query = if let Some(limit) = limit {
                format!(
                    "SELECT id, session_id, command, timestamp, allowed
                     FROM CommandAuditLog
                     WHERE session_id = ?1
                     ORDER BY timestamp DESC
                     LIMIT {}",
                    limit
                )
            } else {
                "SELECT id, session_id, command, timestamp, allowed
                 FROM CommandAuditLog
                 WHERE session_id = ?1
                 ORDER BY timestamp DESC"
                    .to_string()
            };

            let mut stmt = conn.prepare(&query).map_err(|e| AppError::DatabaseError {
                message: format!("准备查询失败: {}", e),
            })?;

            let logs = stmt
                .query_map(params![session_id], |row| {
                    Ok(CommandAuditLog {
                        id: row.get(0)?,
                        session_id: row.get(1)?,
                        command: row.get(2)?,
                        timestamp: row.get(3)?,
                        allowed: row.get(4)?,
                    })
                })
                .map_err(|e| AppError::DatabaseError {
                    message: format!("查询命令日志失败: {}", e),
                })?
                .collect::<Result<Vec<_>, _>>()
                .map_err(|e| AppError::DatabaseError {
                    message: format!("读取命令日志数据失败: {}", e),
                })?;

            Ok(logs)
        })
        .await
        .map_err(|e| AppError::DatabaseError {
            message: format!("查询命令日志任务失败: {}", e),
        })?
    }

    /// 清理旧的历史记录
    ///
    /// # Arguments
    /// * `days` - 保留最近多少天的记录
    pub async fn cleanup_old_history(&self, days: i32) -> AppResult<usize> {
        let pool = self.pool.clone();

        tokio::task::spawn_blocking(move || {
            let conn_arc = pool.get_connection();
            let conn = conn_arc.lock().unwrap();
            let deleted = conn
                .execute(
                    "DELETE FROM SessionHistory
                     WHERE closed_at < datetime('now', '-' || ?1 || ' days')",
                    params![days],
                )
                .map_err(|e| AppError::DatabaseError {
                    message: format!("清理历史记录失败: {}", e),
                })?;

            log::info!("清理了 {} 条旧的会话历史记录 (保留 {} 天)", deleted, days);
            Ok(deleted)
        })
        .await
        .map_err(|e| AppError::DatabaseError {
            message: format!("清理历史记录任务失败: {}", e),
        })?
    }

    /// 清理旧的命令审计日志
    ///
    /// # Arguments
    /// * `days` - 保留最近多少天的记录
    pub async fn cleanup_old_command_logs(&self, days: i32) -> AppResult<usize> {
        let pool = self.pool.clone();

        tokio::task::spawn_blocking(move || {
            let conn_arc = pool.get_connection();
            let conn = conn_arc.lock().unwrap();
            let deleted = conn
                .execute(
                    "DELETE FROM CommandAuditLog
                     WHERE timestamp < datetime('now', '-' || ?1 || ' days')",
                    params![days],
                )
                .map_err(|e| AppError::DatabaseError {
                    message: format!("清理命令审计日志失败: {}", e),
                })?;

            log::info!("清理了 {} 条旧的命令审计日志 (保留 {} 天)", deleted, days);
            Ok(deleted)
        })
        .await
        .map_err(|e| AppError::DatabaseError {
            message: format!("清理命令审计日志任务失败: {}", e),
        })?
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_service() -> TerminalSessionService {
        let pool = DbPool::new_in_memory().unwrap();

        // 初始化数据库表结构
        {
            let conn = pool.get().unwrap();
            // 禁用外键约束（仅用于测试）
            conn.execute("PRAGMA foreign_keys = OFF;", []).unwrap();
            let schema_sql = include_str!("../db/schema.sql");
            conn.execute_batch(schema_sql).unwrap();
        }

        TerminalSessionService::new(pool)
    }

    #[tokio::test]
    async fn test_create_and_get_session() {
        let service = create_test_service();

        let new_session = NewTerminalSession {
            session_id: "test-session-1".to_string(),
            config_id: 1,
            name: Some("Test Session".to_string()),
            work_dir: "/tmp".to_string(),
            is_claude_code: false,
            claude_options: None,
            rows: 24,
            cols: 80,
        };

        // 创建会话
        let id = service.create_session(new_session).await.unwrap();
        assert!(id > 0);

        // 获取会话
        let session = service.get_session("test-session-1").await.unwrap();
        assert!(session.is_some());
        let session = session.unwrap();
        assert_eq!(session.session_id, "test-session-1");
        assert_eq!(session.config_id, 1);
        assert!(session.running);
    }

    #[tokio::test]
    async fn test_close_and_archive_session() {
        let service = create_test_service();

        let new_session = NewTerminalSession {
            session_id: "test-session-2".to_string(),
            config_id: 1,
            name: Some("Test Session 2".to_string()),
            work_dir: "/tmp".to_string(),
            is_claude_code: true,
            claude_options: Some(r#"{"skip_permissions": true}"#.to_string()),
            rows: 30,
            cols: 120,
        };

        service.create_session(new_session).await.unwrap();

        // 关闭会话
        service.close_session("test-session-2", Some(0)).await.unwrap();

        // 归档到历史
        service.move_to_history("test-session-2", Some(0)).await.unwrap();

        // 验证会话已从活跃列表移除
        let session = service.get_session("test-session-2").await.unwrap();
        assert!(session.is_none());

        // 验证历史记录存在
        let history = service.get_session_history(None).await.unwrap();
        assert_eq!(history.len(), 1);
        assert_eq!(history[0].session_id, "test-session-2");
        assert!(history[0].exited_normally);
    }
}
