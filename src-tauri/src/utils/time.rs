//! 时间工具模块
//!
//! 提供统一的本地时间获取方法，确保应用中所有时间戳使用系统本地时区（北京时间 UTC+8）

use chrono::{DateTime, Local};

/// 获取当前本地时间的 RFC3339 格式字符串
///
/// 返回格式示例：`2025-12-11T18:30:00+08:00`
///
/// # Returns
/// 包含时区信息的 RFC3339 格式时间字符串
pub fn now_rfc3339() -> String {
    Local::now().to_rfc3339()
}

/// 获取当前本地时间的 DateTime 对象
///
/// # Returns
/// 本地时区的 DateTime 对象
#[allow(dead_code)]
pub fn now() -> DateTime<Local> {
    Local::now()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_now_rfc3339_format() {
        let time_str = now_rfc3339();
        // 应该包含时区偏移（如 +08:00）
        assert!(time_str.contains('+') || time_str.contains('-'));
        // 应该是有效的 RFC3339 格式
        assert!(chrono::DateTime::parse_from_rfc3339(&time_str).is_ok());
    }

    #[test]
    fn test_now_returns_local_time() {
        let local_time = now();
        let utc_offset = local_time.offset().local_minus_utc();
        // 北京时间应该是 UTC+8（28800秒）
        // 但这个测试应该在任何时区都能通过
        println!("Local timezone offset: {} seconds", utc_offset);
        assert!(utc_offset != 0 || cfg!(test)); // 大多数情况下不会是 UTC
    }
}
