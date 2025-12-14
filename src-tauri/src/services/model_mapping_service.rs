/**
 * 模型映射配置服务
 *
 * 提供模型映射配置的 CRUD 操作
 */

use crate::db::DbPool;
use crate::models::error::{AppError, AppResult};
use crate::models::model_mapping::*;
use rusqlite::{params, OptionalExtension, Row};
use std::sync::Arc;

/// 模型映射服务
pub struct ModelMappingService {
    pool: Arc<DbPool>,
}

impl ModelMappingService {
    /// 创建新的模型映射服务实例
    pub fn new(pool: Arc<DbPool>) -> Self {
        Self { pool }
    }

    /// 从数据库行构建 ModelMapping 对象
    fn row_to_model_mapping(row: &Row) -> Result<ModelMapping, rusqlite::Error> {
        Ok(ModelMapping {
            id: row.get(0)?,
            source_model: row.get(1)?,
            target_model: row.get(2)?,
            direction: MappingDirection::from_str(&row.get::<_, String>(3)?)
                .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(std::io::Error::new(
                    std::io::ErrorKind::InvalidData,
                    e,
                ))))?,
            mapping_type: MappingType::from_str(&row.get::<_, String>(4)?)
                .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(std::io::Error::new(
                    std::io::ErrorKind::InvalidData,
                    e,
                ))))?,
            source_provider: row
                .get::<_, Option<String>>(5)?
                .and_then(|s| ModelProvider::from_str(&s).ok()),
            target_provider: row
                .get::<_, Option<String>>(6)?
                .and_then(|s| ModelProvider::from_str(&s).ok()),
            priority: row.get(7)?,
            description: row.get(8)?,
            notes: row.get(9)?,
            is_enabled: row.get(10)?,
            is_custom: row.get(11)?,
            created_at: row.get(12)?,
            updated_at: row.get(13)?,
        })
    }

    /// 获取所有模型映射配置
    pub async fn list_model_mappings(&self, query: Option<ModelMappingQuery>) -> AppResult<Vec<ModelMapping>> {
        let pool = self.pool.clone();

        tokio::task::spawn_blocking(move || {
            let conn_arc = pool.get_connection();
            let conn = conn_arc.lock().unwrap();

            let mut sql = String::from(
                "SELECT id, source_model, target_model, direction, mapping_type, \
                 source_provider, target_provider, priority, description, notes, \
                 is_enabled, is_custom, created_at, updated_at \
                 FROM ModelMapping WHERE 1=1",
            );

            let mut params: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

            if let Some(q) = query {
                if let Some(source) = q.source_model {
                    sql.push_str(" AND source_model = ?");
                    params.push(Box::new(source));
                }
                if let Some(target) = q.target_model {
                    sql.push_str(" AND target_model = ?");
                    params.push(Box::new(target));
                }
                if let Some(direction) = q.direction {
                    sql.push_str(" AND direction = ?");
                    params.push(Box::new(direction.as_str().to_string()));
                }
                if let Some(mapping_type) = q.mapping_type {
                    sql.push_str(" AND mapping_type = ?");
                    params.push(Box::new(mapping_type.as_str().to_string()));
                }
                if let Some(enabled) = q.is_enabled {
                    sql.push_str(" AND is_enabled = ?");
                    params.push(Box::new(enabled));
                }
                if let Some(custom) = q.is_custom {
                    sql.push_str(" AND is_custom = ?");
                    params.push(Box::new(custom));
                }
            }

            sql.push_str(" ORDER BY priority DESC, created_at DESC");

            let mut stmt = conn.prepare(&sql).map_err(|e| AppError::DatabaseError {
                message: format!("准备查询失败: {}", e),
            })?;

            let param_refs: Vec<&dyn rusqlite::ToSql> = params.iter().map(|p| p.as_ref()).collect();

            let mappings = stmt
                .query_map(param_refs.as_slice(), Self::row_to_model_mapping)
                .map_err(|e| AppError::DatabaseError {
                    message: format!("查询模型映射失败: {}", e),
                })?
                .collect::<Result<Vec<_>, _>>()
                .map_err(|e| AppError::DatabaseError {
                    message: format!("解析模型映射数据失败: {}", e),
                })?;

            Ok(mappings)
        })
        .await
        .map_err(|e| AppError::DatabaseError {
            message: format!("查询模型映射任务失败: {}", e),
        })?
    }

    /// 根据 ID 获取模型映射配置
    pub async fn get_model_mapping(&self, id: i64) -> AppResult<Option<ModelMapping>> {
        let pool = self.pool.clone();

        tokio::task::spawn_blocking(move || {
            let conn_arc = pool.get_connection();
            let conn = conn_arc.lock().unwrap();

            let mapping = conn
                .query_row(
                    "SELECT id, source_model, target_model, direction, mapping_type, \
                     source_provider, target_provider, priority, description, notes, \
                     is_enabled, is_custom, created_at, updated_at \
                     FROM ModelMapping WHERE id = ?",
                    params![id],
                    Self::row_to_model_mapping,
                )
                .optional()
                .map_err(|e| AppError::DatabaseError {
                    message: format!("查询模型映射失败: {}", e),
                })?;

            Ok(mapping)
        })
        .await
        .map_err(|e| AppError::DatabaseError {
            message: format!("查询模型映射任务失败: {}", e),
        })?
    }

    /// 创建模型映射配置
    pub async fn create_model_mapping(&self, request: CreateModelMappingRequest) -> AppResult<ModelMapping> {
        let pool = self.pool.clone();

        tokio::task::spawn_blocking(move || {
            let conn_arc = pool.get_connection();
            let conn = conn_arc.lock().unwrap();

            // 检查是否已存在相同的 source_model + direction 组合
            let exists: bool = conn
                .query_row(
                    "SELECT EXISTS(SELECT 1 FROM ModelMapping WHERE source_model = ? AND direction = ?)",
                    params![request.source_model, request.direction.as_str()],
                    |row| row.get(0),
                )
                .map_err(|e| AppError::DatabaseError {
                    message: format!("检查映射是否存在失败: {}", e),
                })?;

            if exists {
                return Err(AppError::ValidationError {
                    field: "source_model".to_string(),
                    message: format!(
                        "映射 {} ({}) 已存在",
                        request.source_model,
                        request.direction.as_str()
                    ),
                });
            }

            // 插入新记录
            conn.execute(
                "INSERT INTO ModelMapping (source_model, target_model, direction, mapping_type, \
                 source_provider, target_provider, priority, description, notes, is_enabled) \
                 VALUES (?, ?, ?, 'user_defined', ?, ?, ?, ?, ?, ?)",
                params![
                    request.source_model,
                    request.target_model,
                    request.direction.as_str(),
                    request.source_provider.map(|p| p.as_str().to_string()),
                    request.target_provider.map(|p| p.as_str().to_string()),
                    request.priority,
                    request.description,
                    request.notes,
                    request.is_enabled,
                ],
            )
            .map_err(|e| AppError::DatabaseError {
                message: format!("创建模型映射失败: {}", e),
            })?;

            let id = conn.last_insert_rowid();

            // 返回创建的记录
            conn.query_row(
                "SELECT id, source_model, target_model, direction, mapping_type, \
                 source_provider, target_provider, priority, description, notes, \
                 is_enabled, is_custom, created_at, updated_at \
                 FROM ModelMapping WHERE id = ?",
                params![id],
                Self::row_to_model_mapping,
            )
            .map_err(|e| AppError::DatabaseError {
                message: format!("获取创建的模型映射失败: {}", e),
            })
        })
        .await
        .map_err(|e| AppError::DatabaseError {
            message: format!("创建模型映射任务失败: {}", e),
        })?
    }

    /// 更新模型映射配置
    pub async fn update_model_mapping(&self, id: i64, request: UpdateModelMappingRequest) -> AppResult<ModelMapping> {
        let pool = self.pool.clone();

        tokio::task::spawn_blocking(move || {
            let conn_arc = pool.get_connection();
            let conn = conn_arc.lock().unwrap();

            // 检查映射是否存在
            let mapping = conn
                .query_row(
                    "SELECT id, source_model, target_model, direction, mapping_type, \
                     source_provider, target_provider, priority, description, notes, \
                     is_enabled, is_custom, created_at, updated_at \
                     FROM ModelMapping WHERE id = ?",
                    params![id],
                    Self::row_to_model_mapping,
                )
                .optional()
                .map_err(|e| AppError::DatabaseError {
                    message: format!("查询模型映射失败: {}", e),
                })?
                .ok_or_else(|| AppError::NotFound {
                    resource: "ModelMapping".to_string(),
                    id: id.to_string(),
                })?;

            // 如果修改内置映射，将其标记为自定义（表示用户已自定义）
            let should_mark_custom = !mapping.is_custom && (
                request.target_model.is_some()
                || request.priority.is_some()
                || request.description.is_some()
                || request.notes.is_some()
            );

            let mut updates = Vec::new();
            let mut params: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

            if let Some(target_model) = request.target_model {
                updates.push("target_model = ?");
                params.push(Box::new(target_model));
            }
            if let Some(priority) = request.priority {
                updates.push("priority = ?");
                params.push(Box::new(priority));
            }
            if let Some(description) = request.description {
                updates.push("description = ?");
                params.push(Box::new(description));
            }
            if let Some(notes) = request.notes {
                updates.push("notes = ?");
                params.push(Box::new(notes));
            }
            if let Some(is_enabled) = request.is_enabled {
                updates.push("is_enabled = ?");
                params.push(Box::new(is_enabled));
            }

            // 如果修改了内置映射的核心字段，将其标记为自定义
            if should_mark_custom {
                updates.push("is_custom = ?");
                params.push(Box::new(true));
                updates.push("mapping_type = ?");
                params.push(Box::new("user_defined".to_string()));
            }

            if updates.is_empty() {
                return Ok(mapping);
            }

            let sql = format!(
                "UPDATE ModelMapping SET {} WHERE id = ?",
                updates.join(", ")
            );

            params.push(Box::new(id));
            let param_refs: Vec<&dyn rusqlite::ToSql> = params.iter().map(|p| p.as_ref()).collect();

            conn.execute(&sql, param_refs.as_slice())
                .map_err(|e| AppError::DatabaseError {
                    message: format!("更新模型映射失败: {}", e),
                })?;

            // 返回更新后的记录
            conn.query_row(
                "SELECT id, source_model, target_model, direction, mapping_type, \
                 source_provider, target_provider, priority, description, notes, \
                 is_enabled, is_custom, created_at, updated_at \
                 FROM ModelMapping WHERE id = ?",
                params![id],
                Self::row_to_model_mapping,
            )
            .map_err(|e| AppError::DatabaseError {
                message: format!("获取更新后的模型映射失败: {}", e),
            })
        })
        .await
        .map_err(|e| AppError::DatabaseError {
            message: format!("更新模型映射任务失败: {}", e),
        })?
    }

    /// 删除模型映射配置
    pub async fn delete_model_mapping(&self, id: i64) -> AppResult<()> {
        let pool = self.pool.clone();

        tokio::task::spawn_blocking(move || {
            let conn_arc = pool.get_connection();
            let conn = conn_arc.lock().unwrap();

            // 检查映射是否存在
            let mapping = conn
                .query_row(
                    "SELECT id, source_model, target_model, direction, mapping_type, \
                     source_provider, target_provider, priority, description, notes, \
                     is_enabled, is_custom, created_at, updated_at \
                     FROM ModelMapping WHERE id = ?",
                    params![id],
                    Self::row_to_model_mapping,
                )
                .optional()
                .map_err(|e| AppError::DatabaseError {
                    message: format!("查询模型映射失败: {}", e),
                })?
                .ok_or_else(|| AppError::NotFound {
                    resource: "ModelMapping".to_string(),
                    id: id.to_string(),
                })?;

            // 不允许删除系统预设映射
            if !mapping.is_custom {
                return Err(AppError::ValidationError {
                    field: "is_custom".to_string(),
                    message: "不能删除系统预设映射".to_string(),
                });
            }

            conn.execute("DELETE FROM ModelMapping WHERE id = ?", params![id])
                .map_err(|e| AppError::DatabaseError {
                    message: format!("删除模型映射失败: {}", e),
                })?;

            log::info!("已删除模型映射配置: id={}", id);
            Ok(())
        })
        .await
        .map_err(|e| AppError::DatabaseError {
            message: format!("删除模型映射任务失败: {}", e),
        })?
    }

    /// 批量删除模型映射配置
    pub async fn batch_delete_model_mappings(&self, ids: Vec<i64>) -> AppResult<usize> {
        let pool = self.pool.clone();

        tokio::task::spawn_blocking(move || {
            let conn_arc = pool.get_connection();
            let conn = conn_arc.lock().unwrap();

            let mut deleted_count = 0;

            for id in ids {
                // 检查是否为自定义映射
                let mapping = conn
                    .query_row(
                        "SELECT id, source_model, target_model, direction, mapping_type, \
                         source_provider, target_provider, priority, description, notes, \
                         is_enabled, is_custom, created_at, updated_at \
                         FROM ModelMapping WHERE id = ?",
                        params![id],
                        Self::row_to_model_mapping,
                    )
                    .optional()
                    .map_err(|e| AppError::DatabaseError {
                        message: format!("查询模型映射失败: {}", e),
                    })?;

                if let Some(mapping) = mapping {
                    if mapping.is_custom {
                        conn.execute("DELETE FROM ModelMapping WHERE id = ?", params![id])
                            .map_err(|e| AppError::DatabaseError {
                                message: format!("删除模型映射失败: {}", e),
                            })?;
                        deleted_count += 1;
                    }
                }
            }

            log::info!("批量删除了 {} 个模型映射配置", deleted_count);
            Ok(deleted_count)
        })
        .await
        .map_err(|e| AppError::DatabaseError {
            message: format!("批量删除模型映射任务失败: {}", e),
        })?
    }

    /// 导出模型映射配置
    pub async fn export_model_mappings(&self, include_builtin: bool) -> AppResult<ModelMappingExport> {
        let query = if include_builtin {
            None
        } else {
            Some(ModelMappingQuery {
                is_custom: Some(true),
                ..Default::default()
            })
        };

        let mappings = self.list_model_mappings(query).await?;

        let export_items: Vec<ModelMappingExportItem> = mappings
            .into_iter()
            .map(ModelMappingExportItem::from)
            .collect();

        Ok(ModelMappingExport {
            version: "1.0".to_string(),
            exported_at: chrono::Utc::now().to_rfc3339(),
            mappings: export_items,
        })
    }

    /// 导入模型映射配置
    pub async fn import_model_mappings(
        &self,
        export: ModelMappingExport,
        overwrite_existing: bool,
    ) -> AppResult<(usize, usize)> {
        let pool = self.pool.clone();

        tokio::task::spawn_blocking(move || {
            let conn_arc = pool.get_connection();
            let conn = conn_arc.lock().unwrap();

            let mut imported_count = 0;
            let mut skipped_count = 0;

            for item in export.mappings {
                // 检查是否已存在
                let exists: bool = conn
                    .query_row(
                        "SELECT EXISTS(SELECT 1 FROM ModelMapping WHERE source_model = ? AND direction = ?)",
                        params![item.source_model, item.direction.as_str()],
                        |row| row.get(0),
                    )
                    .map_err(|e| AppError::DatabaseError {
                        message: format!("检查映射是否存在失败: {}", e),
                    })?;

                if exists && !overwrite_existing {
                    skipped_count += 1;
                    continue;
                }

                if exists && overwrite_existing {
                    // 更新现有映射
                    conn.execute(
                        "UPDATE ModelMapping SET target_model = ?, priority = ?, description = ?, notes = ? \
                         WHERE source_model = ? AND direction = ?",
                        params![
                            item.target_model,
                            item.priority,
                            item.description,
                            item.notes,
                            item.source_model,
                            item.direction.as_str(),
                        ],
                    )
                    .map_err(|e| AppError::DatabaseError {
                        message: format!("更新模型映射失败: {}", e),
                    })?;
                } else {
                    // 创建新映射
                    conn.execute(
                        "INSERT INTO ModelMapping (source_model, target_model, direction, mapping_type, \
                         source_provider, target_provider, priority, description, notes, is_enabled) \
                         VALUES (?, ?, ?, 'user_defined', ?, ?, ?, ?, ?, ?)",
                        params![
                            item.source_model,
                            item.target_model,
                            item.direction.as_str(),
                            item.source_provider.map(|p| p.as_str().to_string()),
                            item.target_provider.map(|p| p.as_str().to_string()),
                            item.priority,
                            item.description,
                            item.notes,
                            true,
                        ],
                    )
                    .map_err(|e| AppError::DatabaseError {
                        message: format!("创建模型映射失败: {}", e),
                    })?;
                }

                imported_count += 1;
            }

            log::info!(
                "导入模型映射配置完成: 成功={}, 跳过={}",
                imported_count,
                skipped_count
            );

            Ok((imported_count, skipped_count))
        })
        .await
        .map_err(|e| AppError::DatabaseError {
            message: format!("导入模型映射任务失败: {}", e),
        })?
    }

    /// 重置为默认映射 (删除所有自定义映射)
    pub async fn reset_to_default_mappings(&self) -> AppResult<usize> {
        let pool = self.pool.clone();

        tokio::task::spawn_blocking(move || {
            let conn_arc = pool.get_connection();
            let conn = conn_arc.lock().unwrap();

            let deleted_count = conn
                .execute("DELETE FROM ModelMapping WHERE is_custom = 1", [])
                .map_err(|e| AppError::DatabaseError {
                    message: format!("重置默认映射失败: {}", e),
                })?;

            log::info!("已重置为默认映射,删除了 {} 个自定义映射", deleted_count);
            Ok(deleted_count)
        })
        .await
        .map_err(|e| AppError::DatabaseError {
            message: format!("重置默认映射任务失败: {}", e),
        })?
    }

    /// 查询模型映射（同步版本，用于 router 中的请求处理）
    ///
    /// # Arguments
    /// - `conn`: 数据库连接
    /// - `source_model`: 源模型名称
    /// - `direction`: 映射方向字符串 (如 "claude_to_openai", "openai_to_claude" 等)
    ///
    /// # Returns
    /// - `Some(target_model)`: 如果找到启用的映射
    /// - `None`: 如果没有找到映射或映射未启用
    pub fn lookup_target_model(
        conn: &rusqlite::Connection,
        source_model: &str,
        direction: &str,
    ) -> Option<String> {
        // 查询精确匹配或双向映射，按优先级排序
        let result = conn
            .query_row(
                "SELECT target_model FROM ModelMapping \
                 WHERE source_model = ? \
                 AND (direction = ? OR direction = 'bidirectional') \
                 AND is_enabled = 1 \
                 ORDER BY priority DESC \
                 LIMIT 1",
                params![source_model, direction],
                |row| row.get::<_, String>(0),
            )
            .optional();

        match result {
            Ok(Some(target)) => {
                log::info!(
                    "Model mapping found: {} -> {} (direction: {})",
                    source_model,
                    target,
                    direction
                );
                Some(target)
            }
            Ok(None) => {
                log::debug!(
                    "No model mapping found for: {} (direction: {})",
                    source_model,
                    direction
                );
                None
            }
            Err(e) => {
                log::warn!("Model mapping lookup error: {}", e);
                None
            }
        }
    }
}
