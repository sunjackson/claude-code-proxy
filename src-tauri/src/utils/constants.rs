/// 应用常量定义
///
/// 集中管理端口配置，区分开发环境和生产环境

/// 开发环境代理端口
pub const DEV_PROXY_PORT: u16 = 15341;

/// 生产环境代理端口
pub const PROD_PROXY_PORT: u16 = 25341;

/// 获取当前环境的默认代理端口
///
/// - 开发环境 (debug): 15341
/// - 生产环境 (release): 25341
#[inline]
pub fn default_proxy_port() -> u16 {
    if cfg!(debug_assertions) {
        DEV_PROXY_PORT
    } else {
        PROD_PROXY_PORT
    }
}

/// 获取当前环境的默认代理端口（i32 版本，用于数据库兼容）
#[inline]
pub fn default_proxy_port_i32() -> i32 {
    default_proxy_port() as i32
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_port_constants() {
        assert_eq!(DEV_PROXY_PORT, 15341);
        assert_eq!(PROD_PROXY_PORT, 25341);
    }

    #[test]
    fn test_default_proxy_port() {
        let port = default_proxy_port();
        // 在测试中使用 debug 模式，应该返回开发端口
        #[cfg(debug_assertions)]
        assert_eq!(port, DEV_PROXY_PORT);

        #[cfg(not(debug_assertions))]
        assert_eq!(port, PROD_PROXY_PORT);
    }
}
