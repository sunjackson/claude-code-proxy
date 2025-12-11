use crate::models::api_config::{ApiConfig, CreateApiConfigInput, UpdateApiConfigInput, VendorCategory, ProviderType};
use crate::models::error::{AppError, AppResult};
use crate::utils::time::now_rfc3339;
use rusqlite::{Connection, Row};

/// API 配置管理服务
pub struct ApiConfigService;

/// 辅助函数：从数据库行映射到 ApiConfig
///
/// 此函数期望行包含所有 ApiConfig 字段，按以下顺序：
/// id, name, api_key, server_url, server_port, group_id, sort_order,
/// is_available, is_enabled, weight_score, last_success_time, consecutive_failures,
/// last_test_at, last_latency_ms, provider_type,
/// category, is_partner, theme_icon, theme_bg_color, theme_text_color, meta,
/// default_model, haiku_model, sonnet_model, opus_model, small_fast_model,
/// api_timeout_ms, max_output_tokens, balance_query_url, last_balance, balance_currency,
/// last_balance_check_at, balance_query_status, balance_query_error, auto_balance_check,
/// balance_check_interval_sec, created_at, updated_at
#[allow(deprecated)]
fn map_row_to_config(row: &Row) -> rusqlite::Result<ApiConfig> {
    // 解析 provider_type 字段
    let provider_type_str: String = row.get(14)?;
    let provider_type = match provider_type_str.as_str() {
        "gemini" => ProviderType::Gemini,
        _ => ProviderType::Claude,
    };

    // 解析 category 字段
    let category_str: String = row.get(15)?;
    let category = match category_str.as_str() {
        "official" => VendorCategory::Official,
        "cn_official" => VendorCategory::CnOfficial,
        "aggregator" => VendorCategory::Aggregator,
        "third_party" => VendorCategory::ThirdParty,
        _ => VendorCategory::Custom,
    };

    Ok(ApiConfig {
        id: row.get(0)?,
        name: row.get(1)?,
        api_key: row.get(2)?,
        server_url: row.get(3)?,
        server_port: row.get(4)?,
        group_id: row.get(5)?,
        sort_order: row.get(6)?,
        is_available: row.get(7)?,
        is_enabled: row.get(8)?,
        weight_score: row.get(9)?,
        last_success_time: row.get(10)?,
        consecutive_failures: row.get(11)?,
        last_test_at: row.get(12)?,
        last_latency_ms: row.get(13)?,
        provider_type,
        category,
        is_partner: row.get::<_, i32>(16)? != 0,
        theme_icon: row.get(17)?,
        theme_bg_color: row.get(18)?,
        theme_text_color: row.get(19)?,
        meta: row.get(20)?,
        default_model: row.get(21)?,
        haiku_model: row.get(22)?,
        sonnet_model: row.get(23)?,
        opus_model: row.get(24)?,
        small_fast_model: row.get(25)?,
        api_timeout_ms: row.get(26)?,
        max_output_tokens: row.get(27)?,
        balance_query_url: row.get(28)?,
        last_balance: row.get(29)?,
        balance_currency: row.get(30)?,
        last_balance_check_at: row.get(31)?,
        balance_query_status: row.get(32)?,
        balance_query_error: row.get(33)?,
        auto_balance_check: row.get::<_, i32>(34)? != 0,
        balance_check_interval_sec: row.get(35)?,
        created_at: row.get(36)?,
        updated_at: row.get(37)?,
    })
}

impl ApiConfigService {
    /// 创建 API 配置
    ///
    /// # 参数
    /// - `conn`: 数据库连接
    /// - `input`: 创建输入参数
    ///
    /// # 返回
    /// - `Ok(ApiConfig)`: 创建的配置(包含ID, API密钥显示为 [ENCRYPTED])
    /// - `Err(AppError)`: 创建失败
    pub fn create_config(conn: &Connection, input: &CreateApiConfigInput) -> AppResult<ApiConfig> {
        log::info!("正在创建 API 配置: {}", input.name);

        // 验证输入
        input.validate().map_err(|e| AppError::ValidationError {
            field: "input".to_string(),
            message: e,
        })?;

        // 检查配置名称是否重复
        let exists: bool = conn
            .query_row(
                "SELECT EXISTS(SELECT 1 FROM ApiConfig WHERE name = ?1)",
                [&input.name],
                |row| row.get(0),
            )
            .map_err(|e| AppError::DatabaseError {
                message: format!("检查配置名称失败: {}", e),
            })?;

        if exists {
            return Err(AppError::DuplicateEntry {
                field: "name".to_string(),
                value: input.name.clone(),
            });
        }

        // 如果指定了 group_id, 检查分组是否存在
        if let Some(group_id) = input.group_id {
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
        }

        // 获取排序顺序(如果未指定,则使用当前分组的最大值+1)
        let sort_order = if let Some(order) = input.sort_order {
            order
        } else {
            let max_order: Option<i32> = conn
                .query_row(
                    "SELECT MAX(sort_order) FROM ApiConfig WHERE group_id IS ?1",
                    [input.group_id],
                    |row| row.get(0),
                )
                .map_err(|e| AppError::DatabaseError {
                    message: format!("获取最大排序顺序失败: {}", e),
                })?;

            max_order.unwrap_or(0) + 1
        };

        // server_port 字段已弃用，使用默认值 443 以满足数据库约束
        #[allow(deprecated)]
        let server_port = 443;

        // 处理供应商配置默认值
        let provider_type = input.provider_type.as_ref()
            .map(|p| p.to_string())
            .unwrap_or_else(|| "claude".to_string());
        let category = input.category.as_ref()
            .map(|c| c.to_string())
            .unwrap_or_else(|| "custom".to_string());
        let is_partner = input.is_partner.unwrap_or(false);
        let meta = input.meta.as_deref().unwrap_or("{}");

        // 处理余额查询默认值
        let auto_balance_check = input.auto_balance_check.unwrap_or(true);
        let balance_currency = input.balance_currency.as_deref().unwrap_or("CNY");

        // 插入配置(API密钥直接存储到数据库)
        // 使用命名参数以避免 Rusqlite 的 16 参数限制
        conn.execute(
            "INSERT INTO ApiConfig (name, api_key, server_url, server_port, group_id, sort_order,
                                    provider_type, category, is_partner, theme_icon, theme_bg_color, theme_text_color, meta,
                                    default_model, haiku_model, sonnet_model, opus_model, small_fast_model,
                                    api_timeout_ms, max_output_tokens,
                                    balance_query_url, auto_balance_check, balance_check_interval_sec, balance_currency,
                                    created_at, updated_at)
             VALUES (:name, :api_key, :server_url, :server_port, :group_id, :sort_order,
                     :provider_type, :category, :is_partner, :theme_icon, :theme_bg_color, :theme_text_color, :meta,
                     :default_model, :haiku_model, :sonnet_model, :opus_model, :small_fast_model,
                     :api_timeout_ms, :max_output_tokens,
                     :balance_query_url, :auto_balance_check, :balance_check_interval_sec, :balance_currency,
                     CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
            rusqlite::named_params! {
                ":name": &input.name,
                ":api_key": &input.api_key,
                ":server_url": &input.server_url,
                ":server_port": server_port,
                ":group_id": &input.group_id,
                ":sort_order": sort_order,
                ":provider_type": &provider_type,
                ":category": &category,
                ":is_partner": is_partner,
                ":theme_icon": &input.theme_icon,
                ":theme_bg_color": &input.theme_bg_color,
                ":theme_text_color": &input.theme_text_color,
                ":meta": meta,
                ":default_model": &input.default_model,
                ":haiku_model": &input.haiku_model,
                ":sonnet_model": &input.sonnet_model,
                ":opus_model": &input.opus_model,
                ":small_fast_model": &input.small_fast_model,
                ":api_timeout_ms": &input.api_timeout_ms,
                ":max_output_tokens": &input.max_output_tokens,
                ":balance_query_url": &input.balance_query_url,
                ":auto_balance_check": auto_balance_check,
                ":balance_check_interval_sec": &input.balance_check_interval_sec,
                ":balance_currency": balance_currency,
            },
        )
        .map_err(|e| AppError::DatabaseError {
            message: format!("插入配置失败: {}", e),
        })?;

        let id = conn.last_insert_rowid();

        log::info!("API 配置已创建: {} (ID: {})", input.name, id);

        Self::get_config_by_id(conn, id)
    }

    /// 获取配置详情
    pub fn get_config_by_id(conn: &Connection, id: i64) -> AppResult<ApiConfig> {
        conn.query_row(
            "SELECT id, name, api_key, server_url, server_port, group_id, sort_order,
                    is_available, is_enabled, weight_score, last_success_time, consecutive_failures,
                    last_test_at, last_latency_ms, provider_type,
                    category, is_partner, theme_icon, theme_bg_color, theme_text_color, meta,
                    default_model, haiku_model, sonnet_model, opus_model, small_fast_model,
                    api_timeout_ms, max_output_tokens,
                    balance_query_url, last_balance, balance_currency, last_balance_check_at,
                    balance_query_status, balance_query_error, auto_balance_check, balance_check_interval_sec,
                    created_at, updated_at
             FROM ApiConfig WHERE id = ?1",
            [id],
            map_row_to_config,
        )
        .map_err(|e| AppError::DatabaseError {
            message: format!("获取配置失败: {}", e),
        })
    }

    /// 列出所有 API 配置
    ///
    /// # 参数
    /// - `conn`: 数据库连接
    /// - `group_id`: 可选的分组ID筛选
    ///
    /// # 返回
    /// - `Ok(Vec<ApiConfig>)`: 配置列表(按分组和排序顺序排列)
    /// - `Err(AppError)`: 查询失败
    pub fn list_configs(
        conn: &Connection,
        group_id: Option<i64>,
    ) -> AppResult<Vec<ApiConfig>> {
        log::debug!("正在列出 API 配置 (group_id: {:?})", group_id);

        let (sql, params): (String, Vec<Option<i64>>) = if let Some(gid) = group_id {
            (
                "SELECT id, name, api_key, server_url, server_port, group_id, sort_order,
                        is_available, is_enabled, weight_score, last_success_time, consecutive_failures,
                        last_test_at, last_latency_ms, provider_type,
                        category, is_partner, theme_icon, theme_bg_color, theme_text_color, meta,
                        default_model, haiku_model, sonnet_model, opus_model, small_fast_model,
                        api_timeout_ms, max_output_tokens,
                        balance_query_url, last_balance, balance_currency, last_balance_check_at,
                        balance_query_status, balance_query_error, auto_balance_check, balance_check_interval_sec,
                        created_at, updated_at
                 FROM ApiConfig WHERE group_id = ?1 ORDER BY sort_order ASC".to_string(),
                vec![Some(gid)],
            )
        } else {
            (
                "SELECT id, name, api_key, server_url, server_port, group_id, sort_order,
                        is_available, is_enabled, weight_score, last_success_time, consecutive_failures,
                        last_test_at, last_latency_ms, provider_type,
                        category, is_partner, theme_icon, theme_bg_color, theme_text_color, meta,
                        default_model, haiku_model, sonnet_model, opus_model, small_fast_model,
                        api_timeout_ms, max_output_tokens,
                        balance_query_url, last_balance, balance_currency, last_balance_check_at,
                        balance_query_status, balance_query_error, auto_balance_check, balance_check_interval_sec,
                        created_at, updated_at
                 FROM ApiConfig ORDER BY group_id ASC, sort_order ASC".to_string(),
                vec![],
            )
        };

        let mut stmt = conn.prepare(&sql).map_err(|e| AppError::DatabaseError {
            message: format!("准备查询失败: {}", e),
        })?;

        let configs = if params.is_empty() {
            stmt.query_map([], map_row_to_config)
            .map_err(|e| AppError::DatabaseError {
                message: format!("查询配置列表失败: {}", e),
            })?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| AppError::DatabaseError {
                message: format!("解析配置数据失败: {}", e),
            })?
        } else {
            stmt.query_map([&params[0]], map_row_to_config)
            .map_err(|e| AppError::DatabaseError {
                message: format!("查询配置列表失败: {}", e),
            })?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| AppError::DatabaseError {
                message: format!("解析配置数据失败: {}", e),
            })?
        };

        log::debug!("找到 {} 个 API 配置", configs.len());
        Ok(configs)
    }

    /// 更新 API 配置
    ///
    /// # 参数
    /// - `conn`: 数据库连接
    /// - `input`: 更新输入参数
    ///
    /// # 返回
    /// - `Ok(ApiConfig)`: 更新后的配置
    /// - `Err(AppError)`: 更新失败
    #[allow(deprecated)]
    pub fn update_config(conn: &Connection, input: &UpdateApiConfigInput) -> AppResult<ApiConfig> {
        log::info!("正在更新 API 配置: ID {}", input.id);

        // 验证输入
        input.validate().map_err(|e| AppError::ValidationError {
            field: "input".to_string(),
            message: e,
        })?;

        // 检查配置是否存在
        let exists: bool = conn
            .query_row(
                "SELECT EXISTS(SELECT 1 FROM ApiConfig WHERE id = ?1)",
                [input.id],
                |row| row.get(0),
            )
            .map_err(|e| AppError::DatabaseError {
                message: format!("检查配置是否存在失败: {}", e),
            })?;

        if !exists {
            return Err(AppError::NotFound {
                resource: "ApiConfig".to_string(),
                id: input.id.to_string(),
            });
        }

        // 如果更新了名称,检查是否重复
        if let Some(ref name) = input.name {
            let duplicate: bool = conn
                .query_row(
                    "SELECT EXISTS(SELECT 1 FROM ApiConfig WHERE name = ?1 AND id != ?2)",
                    (name, input.id),
                    |row| row.get(0),
                )
                .map_err(|e| AppError::DatabaseError {
                    message: format!("检查配置名称失败: {}", e),
                })?;

            if duplicate {
                return Err(AppError::DuplicateEntry {
                    field: "name".to_string(),
                    value: name.clone(),
                });
            }
        }

        // 如果更新了 group_id, 检查分组是否存在
        if let Some(group_id) = input.group_id {
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
        }

        // 构建动态 UPDATE SQL
        let mut updates = Vec::new();
        let mut params: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

        if let Some(ref name) = input.name {
            updates.push("name = ?");
            params.push(Box::new(name.clone()));
        }

        if let Some(ref server_url) = input.server_url {
            updates.push("server_url = ?");
            params.push(Box::new(server_url.clone()));
        }

        if let Some(server_port) = input.server_port {
            // server_port 字段已弃用，但数据库约束要求值在 1-65535 范围内
            // 如果传入的值无效，使用默认值 443
            let valid_port = if server_port >= 1 && server_port <= 65535 {
                server_port
            } else {
                443
            };
            updates.push("server_port = ?");
            params.push(Box::new(valid_port));
        }

        if let Some(group_id) = input.group_id {
            updates.push("group_id = ?");
            params.push(Box::new(group_id));
        }

        if let Some(sort_order) = input.sort_order {
            updates.push("sort_order = ?");
            params.push(Box::new(sort_order));
        }

        if let Some(is_available) = input.is_available {
            updates.push("is_available = ?");
            params.push(Box::new(is_available));
        }

        if let Some(ref default_model) = input.default_model {
            updates.push("default_model = ?");
            params.push(Box::new(default_model.clone()));
        }

        if let Some(ref haiku_model) = input.haiku_model {
            updates.push("haiku_model = ?");
            params.push(Box::new(haiku_model.clone()));
        }

        if let Some(ref sonnet_model) = input.sonnet_model {
            updates.push("sonnet_model = ?");
            params.push(Box::new(sonnet_model.clone()));
        }

        if let Some(ref opus_model) = input.opus_model {
            updates.push("opus_model = ?");
            params.push(Box::new(opus_model.clone()));
        }

        if let Some(ref small_fast_model) = input.small_fast_model {
            updates.push("small_fast_model = ?");
            params.push(Box::new(small_fast_model.clone()));
        }

        if let Some(api_timeout_ms) = input.api_timeout_ms {
            updates.push("api_timeout_ms = ?");
            params.push(Box::new(api_timeout_ms));
        }

        if let Some(max_output_tokens) = input.max_output_tokens {
            updates.push("max_output_tokens = ?");
            params.push(Box::new(max_output_tokens));
        }

        // 如果更新了 API 密钥,更新数据库
        if let Some(ref api_key) = input.api_key {
            updates.push("api_key = ?");
            params.push(Box::new(api_key.clone()));
        }

        // 供应商配置字段
        if let Some(ref provider_type) = input.provider_type {
            updates.push("provider_type = ?");
            params.push(Box::new(provider_type.to_string()));
        }

        if let Some(ref category) = input.category {
            updates.push("category = ?");
            params.push(Box::new(category.to_string()));
        }

        if let Some(is_partner) = input.is_partner {
            updates.push("is_partner = ?");
            params.push(Box::new(is_partner));
        }

        if let Some(ref theme_icon) = input.theme_icon {
            updates.push("theme_icon = ?");
            params.push(Box::new(theme_icon.clone()));
        }

        if let Some(ref theme_bg_color) = input.theme_bg_color {
            updates.push("theme_bg_color = ?");
            params.push(Box::new(theme_bg_color.clone()));
        }

        if let Some(ref theme_text_color) = input.theme_text_color {
            updates.push("theme_text_color = ?");
            params.push(Box::new(theme_text_color.clone()));
        }

        if let Some(ref meta) = input.meta {
            updates.push("meta = ?");
            params.push(Box::new(meta.clone()));
        }

        // 余额查询字段
        if let Some(ref balance_query_url) = input.balance_query_url {
            updates.push("balance_query_url = ?");
            params.push(Box::new(balance_query_url.clone()));
        }

        if let Some(auto_balance_check) = input.auto_balance_check {
            updates.push("auto_balance_check = ?");
            params.push(Box::new(auto_balance_check));
        }

        if let Some(balance_check_interval_sec) = input.balance_check_interval_sec {
            updates.push("balance_check_interval_sec = ?");
            params.push(Box::new(balance_check_interval_sec));
        }

        if let Some(ref balance_currency) = input.balance_currency {
            updates.push("balance_currency = ?");
            params.push(Box::new(balance_currency.clone()));
        }

        // 如果有字段需要更新
        if !updates.is_empty() {
            updates.push("updated_at = CURRENT_TIMESTAMP");

            let sql = format!("UPDATE ApiConfig SET {} WHERE id = ?", updates.join(", "));
            params.push(Box::new(input.id));

            let params_refs: Vec<&dyn rusqlite::ToSql> =
                params.iter().map(|p| p.as_ref()).collect();

            conn.execute(&sql, params_refs.as_slice())
                .map_err(|e| AppError::DatabaseError {
                    message: format!("更新配置失败: {}", e),
                })?;
        }

        log::info!("API 配置已更新: ID {}", input.id);

        Self::get_config_by_id(conn, input.id)
    }

    /// 删除 API 配置
    ///
    /// # 参数
    /// - `conn`: 数据库连接
    /// - `config_id`: 配置ID
    ///
    /// # 返回
    /// - `Ok(())`: 删除成功
    /// - `Err(AppError)`: 删除失败
    pub fn delete_config(conn: &Connection, config_id: i64) -> AppResult<()> {
        log::info!("正在删除 API 配置: ID {}", config_id);

        // 检查配置是否存在
        let exists: bool = conn
            .query_row(
                "SELECT EXISTS(SELECT 1 FROM ApiConfig WHERE id = ?1)",
                [config_id],
                |row| row.get(0),
            )
            .map_err(|e| AppError::DatabaseError {
                message: format!("检查配置是否存在失败: {}", e),
            })?;

        if !exists {
            return Err(AppError::NotFound {
                resource: "ApiConfig".to_string(),
                id: config_id.to_string(),
            });
        }

        // 删除所有引用该配置的切换日志（由于外键约束 ON DELETE RESTRICT）
        // 这包括 source_config_id 和 target_config_id
        let deleted_logs = conn
            .execute(
                "DELETE FROM SwitchLog WHERE source_config_id = ?1 OR target_config_id = ?1",
                [config_id],
            )
            .map_err(|e| AppError::DatabaseError {
                message: format!("删除相关切换日志失败: {}", e),
            })?;

        if deleted_logs > 0 {
            log::info!("已删除 {} 条引用该配置的切换日志", deleted_logs);
        }

        // 删除数据库中的配置
        conn.execute("DELETE FROM ApiConfig WHERE id = ?1", [config_id])
            .map_err(|e| AppError::DatabaseError {
                message: format!("删除配置失败: {}", e),
            })?;

        log::info!("API 配置已删除: ID {}", config_id);
        Ok(())
    }

    /// 重新排序配置
    ///
    /// # 参数
    /// - `conn`: 数据库连接
    /// - `config_id`: 配置ID
    /// - `new_sort_order`: 新的排序顺序
    ///
    /// # 返回
    /// - `Ok(())`: 重新排序成功
    /// - `Err(AppError)`: 重新排序失败
    pub fn reorder_config(
        conn: &Connection,
        config_id: i64,
        new_sort_order: i32,
    ) -> AppResult<()> {
        log::info!(
            "正在重新排序配置: ID {} -> order {}",
            config_id,
            new_sort_order
        );

        // 检查配置是否存在
        let (exists, old_order, group_id): (bool, i32, Option<i64>) = conn
            .query_row(
                "SELECT 1, sort_order, group_id FROM ApiConfig WHERE id = ?1",
                [config_id],
                |row| Ok((true, row.get(1)?, row.get(2)?)),
            )
            .unwrap_or((false, 0, None));

        if !exists {
            return Err(AppError::NotFound {
                resource: "ApiConfig".to_string(),
                id: config_id.to_string(),
            });
        }

        // 如果排序顺序没有变化,直接返回
        if old_order == new_sort_order {
            return Ok(());
        }

        // 更新其他配置的排序顺序
        // 向上移动: old_order=5, new_order=2 -> [2,5) 的配置 +1
        // 向下移动: old_order=2, new_order=5 -> (2,5] 的配置 -1
        if new_sort_order < old_order {
            // 向上移动
            conn.execute(
                "UPDATE ApiConfig
                 SET sort_order = sort_order + 1
                 WHERE group_id IS ?1 AND sort_order >= ?2 AND sort_order < ?3",
                (group_id, new_sort_order, old_order),
            )
            .map_err(|e| AppError::DatabaseError {
                message: format!("更新排序顺序失败: {}", e),
            })?;
        } else {
            // 向下移动
            conn.execute(
                "UPDATE ApiConfig
                 SET sort_order = sort_order - 1
                 WHERE group_id IS ?1 AND sort_order > ?2 AND sort_order <= ?3",
                (group_id, old_order, new_sort_order),
            )
            .map_err(|e| AppError::DatabaseError {
                message: format!("更新排序顺序失败: {}", e),
            })?;
        }

        // 更新目标配置的排序顺序
        conn.execute(
            "UPDATE ApiConfig SET sort_order = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2",
            (new_sort_order, config_id),
        )
        .map_err(|e| AppError::DatabaseError {
            message: format!("更新配置排序失败: {}", e),
        })?;

        log::info!("配置重新排序完成: ID {}", config_id);
        Ok(())
    }

    /// 获取 API 密钥(从数据库读取)
    ///
    /// # 参数
    /// - `conn`: 数据库连接
    /// - `config_id`: 配置ID
    ///
    /// # 返回
    /// - `Ok(String)`: API密钥明文
    /// - `Err(AppError)`: 获取失败
    pub fn get_api_key(conn: &Connection, config_id: i64) -> AppResult<String> {
        conn.query_row(
            "SELECT api_key FROM ApiConfig WHERE id = ?1",
            [config_id],
            |row| row.get(0),
        )
        .map_err(|e| AppError::DatabaseError {
            message: format!("获取 API 密钥失败: {}", e),
        })
    }

    /// 更新配置的延迟信息
    ///
    /// 在每次请求成功收到响应时调用，记录响应延迟
    ///
    /// # 参数
    /// - `conn`: 数据库连接
    /// - `config_id`: 配置ID
    /// - `latency_ms`: 延迟时间（毫秒）
    ///
    /// # 返回
    /// - `Ok(())`: 更新成功
    /// - `Err(AppError)`: 更新失败
    pub fn update_latency(conn: &Connection, config_id: i64, latency_ms: i32) -> AppResult<()> {
        let now = now_rfc3339();

        conn.execute(
            "UPDATE ApiConfig SET last_test_at = ?1, last_latency_ms = ?2, updated_at = ?3 WHERE id = ?4",
            (now.clone(), latency_ms, now, config_id),
        )
        .map_err(|e| AppError::DatabaseError {
            message: format!("更新配置延迟失败: {}", e),
        })?;

        log::debug!(
            "已更新配置延迟: config_id={}, latency_ms={}",
            config_id,
            latency_ms
        );

        Ok(())
    }

    /// 设置配置的启用状态
    ///
    /// # 参数
    /// - `conn`: 数据库连接
    /// - `config_id`: 配置ID
    /// - `enabled`: 是否启用
    ///
    /// # 返回
    /// - `Ok(ApiConfig)`: 更新后的配置
    /// - `Err(AppError)`: 更新失败
    pub fn set_config_enabled(conn: &Connection, config_id: i64, enabled: bool) -> AppResult<ApiConfig> {
        log::info!("设置配置启用状态: ID {} -> {}", config_id, enabled);

        // 检查配置是否存在
        let exists: bool = conn
            .query_row(
                "SELECT EXISTS(SELECT 1 FROM ApiConfig WHERE id = ?1)",
                [config_id],
                |row| row.get(0),
            )
            .map_err(|e| AppError::DatabaseError {
                message: format!("检查配置是否存在失败: {}", e),
            })?;

        if !exists {
            return Err(AppError::NotFound {
                resource: "ApiConfig".to_string(),
                id: config_id.to_string(),
            });
        }

        // 更新启用状态
        conn.execute(
            "UPDATE ApiConfig SET is_enabled = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2",
            (enabled, config_id),
        )
        .map_err(|e| AppError::DatabaseError {
            message: format!("更新配置启用状态失败: {}", e),
        })?;

        log::info!("配置启用状态已更新: ID {} = {}", config_id, enabled);

        Self::get_config_by_id(conn, config_id)
    }

    /// 更新配置的权重分数
    ///
    /// # 参数
    /// - `conn`: 数据库连接
    /// - `config_id`: 配置ID
    /// - `weight_score`: 权重分数 (0.0 - 1.0)
    ///
    /// # 返回
    /// - `Ok(())`: 更新成功
    /// - `Err(AppError)`: 更新失败
    pub fn update_weight_score(conn: &Connection, config_id: i64, weight_score: f64) -> AppResult<()> {
        // 验证权重范围
        if !(0.0..=1.0).contains(&weight_score) {
            return Err(AppError::ValidationError {
                field: "weight_score".to_string(),
                message: "权重分数必须在 0.0 到 1.0 之间".to_string(),
            });
        }

        conn.execute(
            "UPDATE ApiConfig SET weight_score = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2",
            (weight_score, config_id),
        )
        .map_err(|e| AppError::DatabaseError {
            message: format!("更新权重分数失败: {}", e),
        })?;

        log::debug!("已更新配置权重: config_id={}, weight_score={:.3}", config_id, weight_score);

        Ok(())
    }

    /// 更新配置的成功状态（请求成功时调用）
    ///
    /// 重置连续失败次数，更新最后成功时间
    ///
    /// # 参数
    /// - `conn`: 数据库连接
    /// - `config_id`: 配置ID
    ///
    /// # 返回
    /// - `Ok(())`: 更新成功
    /// - `Err(AppError)`: 更新失败
    pub fn record_success(conn: &Connection, config_id: i64) -> AppResult<()> {
        let now = now_rfc3339();

        conn.execute(
            "UPDATE ApiConfig SET
                consecutive_failures = 0,
                last_success_time = ?1,
                is_available = 1,
                updated_at = ?1
             WHERE id = ?2",
            (&now, config_id),
        )
        .map_err(|e| AppError::DatabaseError {
            message: format!("记录成功状态失败: {}", e),
        })?;

        log::debug!("已记录配置成功状态: config_id={}", config_id);

        Ok(())
    }

    /// 增加配置的连续失败次数
    ///
    /// # 参数
    /// - `conn`: 数据库连接
    /// - `config_id`: 配置ID
    ///
    /// # 返回
    /// - `Ok(i32)`: 更新后的连续失败次数
    /// - `Err(AppError)`: 更新失败
    pub fn increment_failure_count(conn: &Connection, config_id: i64) -> AppResult<i32> {
        conn.execute(
            "UPDATE ApiConfig SET
                consecutive_failures = consecutive_failures + 1,
                updated_at = CURRENT_TIMESTAMP
             WHERE id = ?1",
            [config_id],
        )
        .map_err(|e| AppError::DatabaseError {
            message: format!("增加失败次数失败: {}", e),
        })?;

        // 获取更新后的失败次数
        let count: i32 = conn
            .query_row(
                "SELECT consecutive_failures FROM ApiConfig WHERE id = ?1",
                [config_id],
                |row| row.get(0),
            )
            .map_err(|e| AppError::DatabaseError {
                message: format!("获取失败次数失败: {}", e),
            })?;

        log::debug!("配置连续失败次数: config_id={}, count={}", config_id, count);

        Ok(count)
    }

    /// 列出所有启用且可用的配置
    ///
    /// # 参数
    /// - `conn`: 数据库连接
    /// - `group_id`: 分组ID
    ///
    /// # 返回
    /// - `Ok(Vec<ApiConfig>)`: 启用且可用的配置列表
    /// - `Err(AppError)`: 查询失败
    pub fn list_enabled_available_configs(
        conn: &Connection,
        group_id: i64,
    ) -> AppResult<Vec<ApiConfig>> {
        let mut stmt = conn
            .prepare(
                "SELECT id, name, api_key, server_url, server_port, group_id, sort_order,
                        is_available, is_enabled, weight_score, last_success_time, consecutive_failures,
                        last_test_at, last_latency_ms, provider_type,
                        category, is_partner, theme_icon, theme_bg_color, theme_text_color, meta,
                        default_model, haiku_model, sonnet_model, opus_model, small_fast_model,
                        api_timeout_ms, max_output_tokens,
                        balance_query_url, last_balance, balance_currency, last_balance_check_at,
                        balance_query_status, balance_query_error, auto_balance_check, balance_check_interval_sec,
                        created_at, updated_at
                 FROM ApiConfig
                 WHERE group_id = ?1 AND is_enabled = 1 AND is_available = 1
                 ORDER BY weight_score DESC, sort_order ASC",
            )
            .map_err(|e| AppError::DatabaseError {
                message: format!("准备查询失败: {}", e),
            })?;

        let configs = stmt
            .query_map([group_id], map_row_to_config)
            .map_err(|e| AppError::DatabaseError {
                message: format!("查询配置列表失败: {}", e),
            })?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| AppError::DatabaseError {
                message: format!("解析配置数据失败: {}", e),
            })?;

        log::debug!("找到 {} 个启用且可用的配置 (group_id={})", configs.len(), group_id);
        Ok(configs)
    }
}

#[cfg(all(test, feature = "old_tests"))]
mod tests {
    use super::*;
    use crate::models::config_group::ConfigGroup;
    use crate::services::ConfigManager;

    fn setup_test_db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();

        // 创建测试表
        conn.execute(
            "CREATE TABLE IF NOT EXISTS ConfigGroup (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                description TEXT,
                auto_switch_enabled BOOLEAN NOT NULL DEFAULT 0,
                latency_threshold_ms INTEGER NOT NULL DEFAULT 100000,
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
                api_key TEXT NOT NULL,
                server_url TEXT NOT NULL,
                server_port INTEGER NOT NULL,
                group_id INTEGER,
                sort_order INTEGER NOT NULL DEFAULT 0,
                is_available BOOLEAN NOT NULL DEFAULT 1,
                last_test_at DATETIME,
                last_latency_ms INTEGER,
                default_model TEXT,
                haiku_model TEXT,
                sonnet_model TEXT,
                opus_model TEXT,
                small_fast_model TEXT,
                api_timeout_ms INTEGER,
                max_output_tokens INTEGER,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (group_id) REFERENCES ConfigGroup(id)
            )",
            [],
        )
        .unwrap();

        // 插入默认分组
        let group = ConfigGroup {
            id: 0,
            name: "测试分组".to_string(),
            description: Some("测试用".to_string()),
            auto_switch_enabled: false,
            latency_threshold_ms: 100000,
            created_at: chrono::Local::now().naive_local().to_string(),
            updated_at: chrono::Local::now().naive_local().to_string(),
        };
        ConfigManager::create_group(&conn, &group).unwrap();

        conn
    }

    #[test]
    fn test_create_config() {
        let conn = setup_test_db();

        let input = CreateApiConfigInput {
            name: "测试配置".to_string(),
            api_key: "sk-test-key-123".to_string(),
            server_url: "https://api.example.com".to_string(),
            server_port: Some(443),
            group_id: Some(1),
            sort_order: Some(1),
            category: None,
            is_partner: None,
            theme_icon: None,
            theme_bg_color: None,
            theme_text_color: None,
            meta: None,
            default_model: None,
            haiku_model: None,
            sonnet_model: None,
            opus_model: None,
            small_fast_model: None,
            api_timeout_ms: None,
            max_output_tokens: None,
            balance_query_url: None,
            auto_balance_check: None,
            balance_check_interval_sec: None,
            balance_currency: None,
        };

        let result = ApiConfigService::create_config(&conn, &input);
        assert!(result.is_ok());

        let config = result.unwrap();
        assert!(config.id > 0);
        assert_eq!(config.name, "测试配置");
        assert_eq!(config.api_key, "[ENCRYPTED]");
    }

    #[test]
    fn test_list_configs() {
        let conn = setup_test_db();

        // 创建几个配置
        let input1 = CreateApiConfigInput {
            name: "配置1".to_string(),
            api_key: "sk-test-1".to_string(),
            server_url: "https://api1.example.com".to_string(),
            server_port: Some(443),
            group_id: Some(1),
            sort_order: Some(1),
            category: None,
            is_partner: None,
            theme_icon: None,
            theme_bg_color: None,
            theme_text_color: None,
            meta: None,
            default_model: None,
            haiku_model: None,
            sonnet_model: None,
            opus_model: None,
            small_fast_model: None,
            api_timeout_ms: None,
            max_output_tokens: None,
            balance_query_url: None,
            auto_balance_check: None,
            balance_check_interval_sec: None,
            balance_currency: None,
        };
        ApiConfigService::create_config(&conn, &input1).unwrap();

        let input2 = CreateApiConfigInput {
            name: "配置2".to_string(),
            api_key: "sk-test-2".to_string(),
            server_url: "https://api2.example.com".to_string(),
            server_port: Some(443),
            group_id: Some(1),
            sort_order: Some(2),
            category: None,
            is_partner: None,
            theme_icon: None,
            theme_bg_color: None,
            theme_text_color: None,
            meta: None,
            default_model: None,
            haiku_model: None,
            sonnet_model: None,
            opus_model: None,
            small_fast_model: None,
            api_timeout_ms: None,
            max_output_tokens: None,
            balance_query_url: None,
            auto_balance_check: None,
            balance_check_interval_sec: None,
            balance_currency: None,
        };
        ApiConfigService::create_config(&conn, &input2).unwrap();

        // 列出所有配置
        let configs = ApiConfigService::list_configs(&conn, None).unwrap();
        assert_eq!(configs.len(), 2);

        // 按分组筛选
        let configs = ApiConfigService::list_configs(&conn, Some(1)).unwrap();
        assert_eq!(configs.len(), 2);
    }

    #[test]
    fn test_update_config() {
        let conn = setup_test_db();

        let input = CreateApiConfigInput {
            name: "原始配置".to_string(),
            api_key: "sk-test-key".to_string(),
            server_url: "https://api.example.com".to_string(),
            server_port: Some(443),
            group_id: Some(1),
            sort_order: Some(1),
            category: None,
            is_partner: None,
            theme_icon: None,
            theme_bg_color: None,
            theme_text_color: None,
            meta: None,
            default_model: None,
            haiku_model: None,
            sonnet_model: None,
            opus_model: None,
            small_fast_model: None,
            api_timeout_ms: None,
            max_output_tokens: None,
            balance_query_url: None,
            auto_balance_check: None,
            balance_check_interval_sec: None,
            balance_currency: None,
        };
        let config = ApiConfigService::create_config(&conn, &input).unwrap();

        let update_input = UpdateApiConfigInput {
            id: config.id,
            name: Some("更新后的配置".to_string()),
            api_key: None,
            server_url: None,
            server_port: None,
            group_id: None,
            sort_order: None,
            is_available: None,
            category: None,
            is_partner: None,
            theme_icon: None,
            theme_bg_color: None,
            theme_text_color: None,
            meta: None,
            default_model: None,
            haiku_model: None,
            sonnet_model: None,
            opus_model: None,
            small_fast_model: None,
            api_timeout_ms: None,
            max_output_tokens: None,
            balance_query_url: None,
            auto_balance_check: None,
            balance_check_interval_sec: None,
            balance_currency: None,
        };

        let result = ApiConfigService::update_config(&conn, &update_input);
        assert!(result.is_ok());

        let updated = result.unwrap();
        assert_eq!(updated.name, "更新后的配置");
    }

    #[test]
    fn test_delete_config() {
        let conn = setup_test_db();

        let input = CreateApiConfigInput {
            name: "待删除配置".to_string(),
            api_key: "sk-test-key".to_string(),
            server_url: "https://api.example.com".to_string(),
            server_port: Some(443),
            group_id: Some(1),
            sort_order: Some(1),
            category: None,
            is_partner: None,
            theme_icon: None,
            theme_bg_color: None,
            theme_text_color: None,
            meta: None,
            default_model: None,
            haiku_model: None,
            sonnet_model: None,
            opus_model: None,
            small_fast_model: None,
            api_timeout_ms: None,
            max_output_tokens: None,
            balance_query_url: None,
            auto_balance_check: None,
            balance_check_interval_sec: None,
            balance_currency: None,
        };
        let config = ApiConfigService::create_config(&conn, &input).unwrap();

        let result = ApiConfigService::delete_config(&conn, config.id);
        assert!(result.is_ok());

        // 验证已删除
        let result = ApiConfigService::get_config_by_id(&conn, config.id);
        assert!(result.is_err());
    }
}
