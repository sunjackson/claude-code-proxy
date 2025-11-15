#![allow(dead_code)]

use std::sync::atomic::{AtomicU32, Ordering};

/// 失败计数器 - 线程安全的原子计数器
/// 用于跟踪每个 API 配置的连续失败次数
#[derive(Debug)]
pub struct FailureCounter {
    /// 当前失败次数 (原子操作)
    count: AtomicU32,
}

impl FailureCounter {
    /// 创建新的失败计数器
    pub fn new() -> Self {
        Self {
            count: AtomicU32::new(0),
        }
    }

    /// 增加失败计数 (原子操作)
    /// 返回增加后的值
    pub fn increment(&self) -> u32 {
        self.count.fetch_add(1, Ordering::SeqCst) + 1
    }

    /// 重置失败计数 (原子操作)
    pub fn reset(&self) {
        self.count.store(0, Ordering::SeqCst);
    }

    /// 获取当前失败计数 (原子操作)
    pub fn get_count(&self) -> u32 {
        self.count.load(Ordering::SeqCst)
    }
}

impl Default for FailureCounter {
    fn default() -> Self {
        Self::new()
    }
}

impl Clone for FailureCounter {
    fn clone(&self) -> Self {
        Self {
            count: AtomicU32::new(self.get_count()),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_counter_basic_operations() {
        let counter = FailureCounter::new();
        assert_eq!(counter.get_count(), 0);

        let count1 = counter.increment();
        assert_eq!(count1, 1);
        assert_eq!(counter.get_count(), 1);

        let count2 = counter.increment();
        assert_eq!(count2, 2);
        assert_eq!(counter.get_count(), 2);

        counter.reset();
        assert_eq!(counter.get_count(), 0);
    }

    #[test]
    fn test_counter_clone() {
        let counter1 = FailureCounter::new();
        counter1.increment();
        counter1.increment();

        let counter2 = counter1.clone();
        assert_eq!(counter2.get_count(), 2);

        counter1.increment();
        assert_eq!(counter1.get_count(), 3);
        assert_eq!(counter2.get_count(), 2); // clone 是独立的
    }

    #[test]
    fn test_counter_thread_safety() {
        use std::sync::Arc;
        use std::thread;

        let counter = Arc::new(FailureCounter::new());
        let mut handles = vec![];

        // 10 个线程同时增加计数
        for _ in 0..10 {
            let counter_clone = Arc::clone(&counter);
            let handle = thread::spawn(move || {
                for _ in 0..100 {
                    counter_clone.increment();
                }
            });
            handles.push(handle);
        }

        for handle in handles {
            handle.join().unwrap();
        }

        // 应该正好是 1000
        assert_eq!(counter.get_count(), 1000);
    }
}
