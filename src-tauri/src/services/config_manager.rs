use crate::models::config_group::ConfigGroup;
use crate::models::error::{AppError, AppResult};
use rusqlite::Connection;

/// 配置分组管理服务
pub struct ConfigManager;

impl ConfigManager {
    /// 创建配置分组
    ///
    /// # 参数
    /// - `conn`: 数据库连接
    /// - `group`: 配置分组信息
    ///
    /// # 返回
    /// - `Ok(ConfigGroup)`: 创建的分组(包含ID)
    /// - `Err(AppError)`: 创建失败
    pub fn create_group(conn: &Connection, group: &ConfigGroup) -> AppResult<ConfigGroup> {
        log::info!("正在创建配置分组: {}", group.name);

        // 验证分组数据
        group.validate()?;

        // 检查分组名称是否重复
        let exists: bool = conn
            .query_row(
                "SELECT EXISTS(SELECT 1 FROM ConfigGroup WHERE name = ?1)",
                [&group.name],
                |row| row.get(0),
            )
            .map_err(|e| AppError::DatabaseError {
                message: format!("检查分组名称失败: {}", e),
            })?;

        if exists {
            return Err(AppError::DuplicateEntry {
                field: "name".to_string(),
                value: group.name.clone(),
            });
        }

        // 插入分组
        conn.execute(
            "INSERT INTO ConfigGroup (name, description, auto_switch_enabled, latency_threshold_ms, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
            (
                &group.name,
                &group.description,
                &group.auto_switch_enabled,
                &group.latency_threshold_ms,
            ),
        )
        .map_err(|e| AppError::DatabaseError {
            message: format!("插入分组失败: {}", e),
        })?;

        let id = conn.last_insert_rowid();

        log::info!("配置分组已创建: {} (ID: {})", group.name, id);

        Self::get_group_by_id(conn, id)
    }

    /// 获取分组详情
    pub fn get_group_by_id(conn: &Connection, id: i64) -> AppResult<ConfigGroup> {
        conn.query_row(
            "SELECT id, name, description, auto_switch_enabled, latency_threshold_ms, created_at, updated_at
             FROM ConfigGroup WHERE id = ?1",
            [id],
            |row| {
                Ok(ConfigGroup {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    description: row.get(2)?,
                    auto_switch_enabled: row.get(3)?,
                    latency_threshold_ms: row.get(4)?,
                    created_at: row.get(5)?,
                    updated_at: row.get(6)?,
                })
            },
        )
        .map_err(|e| AppError::DatabaseError {
            message: format!("获取分组失败: {}", e),
        })
    }

    /// 列出所有配置分组
    ///
    /// # 返回
    /// - `Ok(Vec<ConfigGroup>)`: 分组列表
    /// - `Err(AppError)`: 查询失败
    pub fn list_groups(conn: &Connection) -> AppResult<Vec<ConfigGroup>> {
        log::debug!("正在列出所有配置分组");

        let mut stmt = conn
            .prepare(
                "SELECT id, name, description, auto_switch_enabled, latency_threshold_ms, created_at, updated_at
                 FROM ConfigGroup ORDER BY id ASC",
            )
            .map_err(|e| AppError::DatabaseError {
                message: format!("准备查询失败: {}", e),
            })?;

        let groups = stmt
            .query_map([], |row| {
                Ok(ConfigGroup {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    description: row.get(2)?,
                    auto_switch_enabled: row.get(3)?,
                    latency_threshold_ms: row.get(4)?,
                    created_at: row.get(5)?,
                    updated_at: row.get(6)?,
                })
            })
            .map_err(|e| AppError::DatabaseError {
                message: format!("查询分组列表失败: {}", e),
            })?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| AppError::DatabaseError {
                message: format!("解析分组数据失败: {}", e),
            })?;

        log::debug!("找到 {} 个配置分组", groups.len());
        Ok(groups)
    }

    /// 更新配置分组
    ///
    /// # 参数
    /// - `conn`: 数据库连接
    /// - `group`: 更新后的分组信息(必须包含有效的ID)
    ///
    /// # 返回
    /// - `Ok(ConfigGroup)`: 更新后的分组
    /// - `Err(AppError)`: 更新失败
    pub fn update_group(conn: &Connection, group: &ConfigGroup) -> AppResult<ConfigGroup> {
        log::info!("正在更新配置分组: {} (ID: {})", group.name, group.id);

        // 验证分组数据
        group.validate()?;

        // 检查分组是否存在
        let exists: bool = conn
            .query_row(
                "SELECT EXISTS(SELECT 1 FROM ConfigGroup WHERE id = ?1)",
                [group.id],
                |row| row.get(0),
            )
            .map_err(|e| AppError::DatabaseError {
                message: format!("检查分组是否存在失败: {}", e),
            })?;

        if !exists {
            return Err(AppError::NotFound {
                resource: "ConfigGroup".to_string(),
                id: group.id.to_string(),
            });
        }

        // 检查名称是否与其他分组重复
        let duplicate: bool = conn
            .query_row(
                "SELECT EXISTS(SELECT 1 FROM ConfigGroup WHERE name = ?1 AND id != ?2)",
                (&group.name, group.id),
                |row| row.get(0),
            )
            .map_err(|e| AppError::DatabaseError {
                message: format!("检查分组名称失败: {}", e),
            })?;

        if duplicate {
            return Err(AppError::DuplicateEntry {
                field: "name".to_string(),
                value: group.name.clone(),
            });
        }

        // 更新分组
        conn.execute(
            "UPDATE ConfigGroup
             SET name = ?1, description = ?2, auto_switch_enabled = ?3, latency_threshold_ms = ?4, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?5",
            (
                &group.name,
                &group.description,
                &group.auto_switch_enabled,
                &group.latency_threshold_ms,
                group.id,
            ),
        )
        .map_err(|e| AppError::DatabaseError {
            message: format!("更新分组失败: {}", e),
        })?;

        log::info!("配置分组已更新: {} (ID: {})", group.name, group.id);

        Self::get_group_by_id(conn, group.id)
    }

    /// 删除配置分组
    ///
    /// # 参数
    /// - `conn`: 数据库连接
    /// - `group_id`: 分组ID
    /// - `move_to_default`: 是否将分组下的配置移到"未分组"(true: 移动, false: 删除配置)
    ///
    /// # 返回
    /// - `Ok(())`: 删除成功
    /// - `Err(AppError)`: 删除失败
    pub fn delete_group(
        conn: &Connection,
        group_id: i64,
        move_to_default: bool,
    ) -> AppResult<()> {
        log::info!(
            "正在删除配置分组 ID: {} (移动配置: {})",
            group_id,
            move_to_default
        );

        // 检查分组是否存在
        let group_exists: bool = conn
            .query_row(
                "SELECT EXISTS(SELECT 1 FROM ConfigGroup WHERE id = ?1)",
                [group_id],
                |row| row.get(0),
            )
            .map_err(|e| AppError::DatabaseError {
                message: format!("检查分组是否存在失败: {}", e),
            })?;

        if !group_exists {
            return Err(AppError::NotFound {
                resource: "ConfigGroup".to_string(),
                id: group_id.to_string(),
            });
        }

        // 检查分组内的配置数量
        let config_count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM ApiConfig WHERE group_id = ?1",
                [group_id],
                |row| row.get(0),
            )
            .map_err(|e| AppError::DatabaseError {
                message: format!("统计分组内配置数量失败: {}", e),
            })?;

        // 如果分组包含配置，需要进一步检查
        if config_count > 0 {
            if !move_to_default {
                // 不允许移动配置，禁止删除
                return Err(AppError::ValidationError {
                    field: "id".to_string(),
                    message: format!("该分组包含 {} 个配置，请先删除或移动这些配置", config_count),
                });
            } else {
                // 允许移动配置，检查是否有其他分组可用
                let other_group_exists: bool = conn
                    .query_row(
                        "SELECT EXISTS(SELECT 1 FROM ConfigGroup WHERE id != ?1)",
                        [group_id],
                        |row| row.get(0),
                    )
                    .map_err(|e| AppError::DatabaseError {
                        message: format!("检查其他分组是否存在失败: {}", e),
                    })?;

                if !other_group_exists {
                    return Err(AppError::ValidationError {
                        field: "id".to_string(),
                        message: format!(
                            "该分组包含 {} 个配置且没有其他分组可以移动配置，请先删除这些配置",
                            config_count
                        ),
                    });
                }
            }
        }

        // 如果需要移动配置，获取一个目标分组
        let target_group_id: Option<i64> = if move_to_default && config_count > 0 {
            // 查找第一个不是当前分组的分组ID
            let target_id: i64 = conn
                .query_row(
                    "SELECT id FROM ConfigGroup WHERE id != ?1 ORDER BY id ASC LIMIT 1",
                    [group_id],
                    |row| row.get(0),
                )
                .map_err(|e| AppError::DatabaseError {
                    message: format!("获取目标分组ID失败: {}", e),
                })?;
            Some(target_id)
        } else {
            None
        };

        // 处理分组下的配置
        if let Some(target_id) = target_group_id {
            // 将配置移到目标分组
            conn.execute(
                "UPDATE ApiConfig SET group_id = ?1 WHERE group_id = ?2",
                [target_id, group_id],
            )
            .map_err(|e| AppError::DatabaseError {
                message: format!("移动配置到其他分组失败: {}", e),
            })?;

            log::info!("已将配置从分组 {} 移动到分组 {}", group_id, target_id);
        } else {
            // 删除分组下的所有配置
            conn.execute("DELETE FROM ApiConfig WHERE group_id = ?1", [group_id])
                .map_err(|e| AppError::DatabaseError {
                    message: format!("删除配置失败: {}", e),
                })?;

            log::info!("已删除分组 {} 下的所有配置", group_id);
        }

        // 删除分组相关的切换日志（SwitchLog 有 RESTRICT 外键约束）
        let deleted_logs = conn.execute("DELETE FROM SwitchLog WHERE group_id = ?1", [group_id])
            .map_err(|e| AppError::DatabaseError {
                message: format!("删除切换日志失败: {}", e),
            })?;

        if deleted_logs > 0 {
            log::info!("已删除分组 {} 的 {} 条切换日志", group_id, deleted_logs);
        }

        // 删除分组
        conn.execute("DELETE FROM ConfigGroup WHERE id = ?1", [group_id])
            .map_err(|e| AppError::DatabaseError {
                message: format!("删除分组失败: {}", e),
            })?;

        log::info!("配置分组已删除: ID {}", group_id);
        Ok(())
    }

    /// 统计分组下的配置数量
    pub fn count_configs_in_group(conn: &Connection, group_id: i64) -> AppResult<i64> {
        conn.query_row(
            "SELECT COUNT(*) FROM ApiConfig WHERE group_id = ?1",
            [group_id],
            |row| row.get(0),
        )
        .map_err(|e| AppError::DatabaseError {
            message: format!("统计配置数量失败: {}", e),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn setup_test_db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        // 创建简化的测试表
        conn.execute(
            "CREATE TABLE IF NOT EXISTS ConfigGroup (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                description TEXT,
                auto_switch_enabled BOOLEAN NOT NULL DEFAULT 0,
                latency_threshold_ms INTEGER NOT NULL DEFAULT 30000,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            )",
            [],
        )
        .unwrap();

        conn.execute(
            "CREATE TABLE IF NOT EXISTS ApiConfig (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                group_id INTEGER DEFAULT 0
            )",
            [],
        )
        .unwrap();

        // 插入默认的"未分组"
        conn.execute(
            "INSERT INTO ConfigGroup (id, name, description) VALUES (0, '未分组', '默认分组')",
            [],
        )
        .unwrap();

        conn
    }

    #[test]
    fn test_create_group() {
        let conn = setup_test_db();

        let group = ConfigGroup {
            id: 0,
            name: "测试分组".to_string(),
            description: Some("测试描述".to_string()),
            auto_switch_enabled: false,
            latency_threshold_ms: 30000,
            created_at: chrono::Local::now().naive_local().to_string(),
            updated_at: chrono::Local::now().naive_local().to_string(),
        };

        let result = ConfigManager::create_group(&conn, &group);
        assert!(result.is_ok());

        let created = result.unwrap();
        assert!(created.id > 0);
        assert_eq!(created.name, "测试分组");
    }

    #[test]
    fn test_list_groups() {
        let conn = setup_test_db();

        let groups = ConfigManager::list_groups(&conn).unwrap();
        assert_eq!(groups.len(), 1); // 只有默认的"未分组"
        assert_eq!(groups[0].id, 0);
    }

    #[test]
    fn test_delete_last_group_should_fail() {
        let conn = setup_test_db();

        // 只有一个分组时，不能删除
        let result = ConfigManager::delete_group(&conn, 0, true);
        assert!(result.is_err());

        // 验证错误消息
        if let Err(e) = result {
            match e {
                AppError::ValidationError { message, .. } => {
                    assert!(message.contains("至少需要保留一个配置分组"));
                }
                _ => panic!("Expected ValidationError"),
            }
        }
    }

    #[test]
    fn test_delete_group_with_multiple_groups() {
        let conn = setup_test_db();

        // 创建第二个分组
        let group = ConfigGroup {
            id: 0,
            name: "测试分组2".to_string(),
            description: Some("第二个分组".to_string()),
            auto_switch_enabled: false,
            latency_threshold_ms: 30000,
            created_at: chrono::Local::now().naive_local().to_string(),
            updated_at: chrono::Local::now().naive_local().to_string(),
        };
        let created = ConfigManager::create_group(&conn, &group).unwrap();

        // 现在可以删除其中一个分组
        let result = ConfigManager::delete_group(&conn, created.id, true);
        assert!(result.is_ok());

        // 验证分组已删除
        let groups = ConfigManager::list_groups(&conn).unwrap();
        assert_eq!(groups.len(), 1);
    }
}
