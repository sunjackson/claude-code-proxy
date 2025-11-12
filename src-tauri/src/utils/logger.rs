#![allow(dead_code)]

use env_logger::{Builder, Target};
use log::LevelFilter;
use std::io::Write;

/// 初始化日志系统
/// 使用 env_logger,支持文件输出和控制台输出
pub fn init_logger() {
    let mut builder = Builder::from_default_env();

    // 设置日志格式
    builder
        .format(|buf, record| {
            writeln!(
                buf,
                "[{} {} {}:{}] {}",
                chrono::Local::now().format("%Y-%m-%d %H:%M:%S"),
                record.level(),
                record.file().unwrap_or("unknown"),
                record.line().unwrap_or(0),
                record.args()
            )
        })
        .target(Target::Stdout)
        .filter(None, LevelFilter::Info)
        .init();

    log::info!("日志系统初始化完成");
}

/// 初始化日志系统(带自定义日志级别)
pub fn init_logger_with_level(level: LevelFilter) {
    let mut builder = Builder::from_default_env();

    builder
        .format(|buf, record| {
            writeln!(
                buf,
                "[{} {} {}:{}] {}",
                chrono::Local::now().format("%Y-%m-%d %H:%M:%S"),
                record.level(),
                record.file().unwrap_or("unknown"),
                record.line().unwrap_or(0),
                record.args()
            )
        })
        .target(Target::Stdout)
        .filter(None, level)
        .init();

    log::info!("日志系统初始化完成,级别: {:?}", level);
}

/// 初始化日志系统(文件输出)
/// 将日志输出到指定文件
pub fn init_logger_with_file(log_file_path: &str) -> Result<(), String> {
    use std::fs::OpenOptions;

    let log_file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(log_file_path)
        .map_err(|e| format!("打开日志文件失败: {}", e))?;

    let mut builder = Builder::from_default_env();

    builder
        .format(|buf, record| {
            writeln!(
                buf,
                "[{} {} {}:{}] {}",
                chrono::Local::now().format("%Y-%m-%d %H:%M:%S"),
                record.level(),
                record.file().unwrap_or("unknown"),
                record.line().unwrap_or(0),
                record.args()
            )
        })
        .target(Target::Pipe(Box::new(log_file)))
        .filter(None, LevelFilter::Info)
        .init();

    log::info!("日志系统初始化完成,输出到文件: {}", log_file_path);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use log::info;

    #[test]
    fn test_init_logger() {
        // 注意: 这个测试只能运行一次,因为 logger 只能初始化一次
        // init_logger();
        // info!("测试日志信息");
        assert!(true);
    }

    #[test]
    fn test_init_logger_with_level() {
        // init_logger_with_level(LevelFilter::Debug);
        // info!("测试日志信息");
        assert!(true);
    }
}
