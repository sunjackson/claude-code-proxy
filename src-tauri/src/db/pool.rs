#![allow(dead_code)]

use crate::models::error::{AppError, AppResult};
use rusqlite::Connection;
use std::sync::{Arc, Mutex};

/// 数据库连接池
/// 使用简单的单连接模式,因为 SQLite 对并发写入的支持有限
/// 对于更高并发需求,可以考虑使用 r2d2 或其他连接池库
#[derive(Clone)]
pub struct DbPool {
    connection: Arc<Mutex<Connection>>,
}

impl DbPool {
    /// 创建新的数据库连接池
    pub fn new(conn: Connection) -> Self {
        DbPool {
            connection: Arc::new(Mutex::new(conn)),
        }
    }

    /// 获取数据库连接
    /// 返回 Arc<Mutex<Connection>> 用于多线程访问
    pub fn get_connection(&self) -> Arc<Mutex<Connection>> {
        Arc::clone(&self.connection)
    }

    /// 获取数据库连接（返回 MutexGuard）
    /// 用于需要直接访问连接的场景
    pub fn get(&self) -> Result<std::sync::MutexGuard<'_, Connection>, AppError> {
        self.connection.lock().map_err(|e| AppError::DatabaseError {
            message: format!("获取数据库连接锁失败: {}", e),
        })
    }

    /// 创建内存数据库连接池（用于测试）
    #[cfg(test)]
    pub fn new_in_memory() -> AppResult<Self> {
        let conn = Connection::open_in_memory()
            .map_err(|e| AppError::DatabaseError {
                message: format!("创建内存数据库失败: {}", e),
            })?;

        // 启用外键约束
        conn.execute("PRAGMA foreign_keys = ON;", [])
            .map_err(|e| AppError::DatabaseError {
                message: format!("启用外键约束失败: {}", e),
            })?;

        Ok(Self::new(conn))
    }

    /// 执行只读操作
    /// 接受一个闭包,传入连接引用
    pub fn with_connection<F, T>(&self, f: F) -> AppResult<T>
    where
        F: FnOnce(&Connection) -> AppResult<T>,
    {
        let conn = self.connection.lock().map_err(|e| AppError::DatabaseError {
            message: format!("获取数据库连接锁失败: {}", e),
        })?;
        f(&conn)
    }

    /// 执行事务操作
    /// 自动处理 BEGIN/COMMIT/ROLLBACK
    pub fn transaction<F, T>(&self, f: F) -> AppResult<T>
    where
        F: FnOnce(&Connection) -> AppResult<T>,
    {
        let conn = self.connection.lock().map_err(|e| AppError::DatabaseError {
            message: format!("获取数据库连接锁失败: {}", e),
        })?;

        // 开始事务
        conn.execute("BEGIN TRANSACTION", [])
            .map_err(|e| AppError::DatabaseError {
                message: format!("开始事务失败: {}", e),
            })?;

        // 执行操作
        let result = f(&conn);

        match result {
            Ok(value) => {
                // 提交事务
                conn.execute("COMMIT", []).map_err(|e| AppError::DatabaseError {
                    message: format!("提交事务失败: {}", e),
                })?;
                Ok(value)
            }
            Err(err) => {
                // 回滚事务
                let _ = conn.execute("ROLLBACK", []);
                Err(err)
            }
        }
    }

    /// 执行批量操作
    /// 在单个事务中执行多个操作
    pub fn batch<F>(&self, f: F) -> AppResult<()>
    where
        F: FnOnce(&Connection) -> AppResult<()>,
    {
        self.transaction(f)
    }

    /// 检查连接池健康状态
    pub fn health_check(&self) -> AppResult<()> {
        self.with_connection(|conn| {
            // 使用 query_row 执行简单查询验证连接
            conn.query_row("SELECT 1", [], |_| Ok(()))
                .map_err(|e| AppError::DatabaseError {
                    message: format!("健康检查失败: {}", e),
                })?;
            Ok(())
        })
    }

    /// 优化数据库 (VACUUM)
    /// 应定期执行以回收空间和优化性能
    pub fn optimize(&self) -> AppResult<()> {
        log::info!("正在优化数据库...");

        self.with_connection(|conn| {
            conn.execute("VACUUM", []).map_err(|e| AppError::DatabaseError {
                message: format!("数据库优化失败: {}", e),
            })?;

            conn.execute("ANALYZE", [])
                .map_err(|e| AppError::DatabaseError {
                    message: format!("数据库分析失败: {}", e),
                })?;

            Ok(())
        })?;

        log::info!("数据库优化完成");
        Ok(())
    }

    /// 获取数据库统计信息
    pub fn get_stats(&self) -> AppResult<DatabaseStats> {
        self.with_connection(|conn| {
            let page_count: i64 =
                conn.query_row("PRAGMA page_count", [], |row| row.get(0))
                    .map_err(|e| AppError::DatabaseError {
                        message: format!("获取页数失败: {}", e),
                    })?;

            let page_size: i64 =
                conn.query_row("PRAGMA page_size", [], |row| row.get(0))
                    .map_err(|e| AppError::DatabaseError {
                        message: format!("获取页大小失败: {}", e),
                    })?;

            let freelist_count: i64 =
                conn.query_row("PRAGMA freelist_count", [], |row| row.get(0))
                    .map_err(|e| AppError::DatabaseError {
                        message: format!("获取空闲页数失败: {}", e),
                    })?;

            Ok(DatabaseStats {
                total_pages: page_count,
                page_size: page_size,
                free_pages: freelist_count,
                db_size_bytes: page_count * page_size,
            })
        })
    }
}

/// 数据库统计信息
#[derive(Debug, Clone)]
pub struct DatabaseStats {
    pub total_pages: i64,
    pub page_size: i64,
    pub free_pages: i64,
    pub db_size_bytes: i64,
}

impl DatabaseStats {
    /// 获取数据库大小 (MB)
    pub fn size_mb(&self) -> f64 {
        self.db_size_bytes as f64 / 1024.0 / 1024.0
    }

    /// 获取空闲空间占比
    pub fn free_ratio(&self) -> f64 {
        if self.total_pages == 0 {
            0.0
        } else {
            self.free_pages as f64 / self.total_pages as f64
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_db_pool_creation() {
        let conn = Connection::open_in_memory().unwrap();
        let pool = DbPool::new(conn);

        // 验证健康检查
        let result = pool.health_check();
        assert!(result.is_ok());
    }

    #[test]
    fn test_with_connection() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute("CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)", [])
            .unwrap();

        let pool = DbPool::new(conn);

        let result = pool.with_connection(|conn| {
            conn.execute("INSERT INTO test (name) VALUES (?)", ["Alice"])
                .map_err(|e| AppError::DatabaseError {
                    message: e.to_string(),
                })?;
            Ok(())
        });

        assert!(result.is_ok());
    }

    #[test]
    fn test_transaction_commit() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute("CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)", [])
            .unwrap();

        let pool = DbPool::new(conn);

        let result = pool.transaction(|conn| {
            conn.execute("INSERT INTO test (name) VALUES (?)", ["Bob"])
                .map_err(|e| AppError::DatabaseError {
                    message: e.to_string(),
                })?;
            Ok(())
        });

        assert!(result.is_ok());

        // 验证数据已提交
        let count: i64 = pool
            .with_connection(|conn| {
                conn.query_row("SELECT COUNT(*) FROM test", [], |row| row.get(0))
                    .map_err(|e| AppError::DatabaseError {
                        message: e.to_string(),
                    })
            })
            .unwrap();

        assert_eq!(count, 1);
    }

    #[test]
    fn test_transaction_rollback() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute("CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)", [])
            .unwrap();

        let pool = DbPool::new(conn);

        // 执行会失败的事务
        let result: AppResult<()> = pool.transaction(|conn| {
            conn.execute("INSERT INTO test (name) VALUES (?)", ["Charlie"])
                .map_err(|e| AppError::DatabaseError {
                    message: e.to_string(),
                })?;

            // 模拟错误,触发回滚
            Err(AppError::ValidationError {
                field: "test".to_string(),
                message: "测试回滚".to_string(),
            })
        });

        assert!(result.is_err());

        // 验证数据未提交
        let count: i64 = pool
            .with_connection(|conn| {
                conn.query_row("SELECT COUNT(*) FROM test", [], |row| row.get(0))
                    .map_err(|e| AppError::DatabaseError {
                        message: e.to_string(),
                    })
            })
            .unwrap();

        assert_eq!(count, 0);
    }

    #[test]
    fn test_get_stats() {
        let conn = Connection::open_in_memory().unwrap();
        let pool = DbPool::new(conn);

        let stats = pool.get_stats();
        assert!(stats.is_ok());

        let stats = stats.unwrap();
        assert!(stats.total_pages >= 0);
        assert!(stats.page_size > 0);
        assert!(stats.db_size_bytes >= 0);
    }
}
