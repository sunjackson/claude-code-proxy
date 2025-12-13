/**
 * Session Config Map Module
 *
 * Manages session-specific API configuration routing.
 * Each terminal session can have its own API config, allowing
 * different terminals to use different service providers simultaneously.
 *
 * Key Design:
 * - session_id: Unique identifier for each terminal session (e.g., "session_1")
 * - config_id: The API configuration ID to use for requests from this session
 * - Thread-safe using RwLock for concurrent access
 * - Supports dynamic switching without terminal restart
 */

use std::collections::HashMap;
use std::sync::RwLock;
use chrono::{DateTime, Utc};

/// Session configuration entry with metadata
#[derive(Debug, Clone)]
pub struct SessionConfigEntry {
    /// API configuration ID
    pub config_id: i64,
    /// Session creation time
    pub created_at: DateTime<Utc>,
    /// Last request time (for cleanup)
    pub last_used_at: DateTime<Utc>,
    /// Optional session name/label
    pub name: Option<String>,
}

/// Global session-to-config mapping
///
/// Usage:
/// - Terminal creates session: `SESSION_CONFIG_MAP.register("session_1", config_id)`
/// - Proxy routes request: `SESSION_CONFIG_MAP.get_config_id("session_1")`
/// - Terminal switches provider: `SESSION_CONFIG_MAP.switch("session_1", new_config_id)`
/// - Terminal closes: `SESSION_CONFIG_MAP.remove("session_1")`
pub struct SessionConfigMap {
    /// Map from session_id to config entry
    map: RwLock<HashMap<String, SessionConfigEntry>>,
}

impl SessionConfigMap {
    /// Create a new empty session config map
    pub fn new() -> Self {
        Self {
            map: RwLock::new(HashMap::new()),
        }
    }

    /// Register a new session with its initial config
    ///
    /// # Arguments
    /// - `session_id`: Unique session identifier
    /// - `config_id`: Initial API configuration ID
    /// - `name`: Optional session name/label
    pub fn register(&self, session_id: String, config_id: i64, name: Option<String>) {
        let mut map = self.map.write().unwrap();
        let now = Utc::now();
        map.insert(
            session_id.clone(),
            SessionConfigEntry {
                config_id,
                created_at: now,
                last_used_at: now,
                name,
            },
        );
        log::debug!("Session registered: {} -> config_id={}", session_id, config_id);
    }

    /// Switch a session to use a different config
    ///
    /// # Arguments
    /// - `session_id`: Session to switch
    /// - `new_config_id`: New API configuration ID
    ///
    /// # Returns
    /// - `true` if session existed and was updated
    /// - `false` if session not found
    pub fn switch(&self, session_id: &str, new_config_id: i64) -> bool {
        let mut map = self.map.write().unwrap();
        if let Some(entry) = map.get_mut(session_id) {
            let old_config_id = entry.config_id;
            entry.config_id = new_config_id;
            entry.last_used_at = Utc::now();
            log::info!(
                "Session config switched: {} from {} to {}",
                session_id, old_config_id, new_config_id
            );
            true
        } else {
            log::warn!("Session not found for switch: {}", session_id);
            false
        }
    }

    /// Get the config ID for a session
    ///
    /// # Arguments
    /// - `session_id`: Session to look up
    ///
    /// # Returns
    /// - `Some(config_id)` if session exists
    /// - `None` if session not found
    pub fn get_config_id(&self, session_id: &str) -> Option<i64> {
        let mut map = self.map.write().unwrap();
        if let Some(entry) = map.get_mut(session_id) {
            entry.last_used_at = Utc::now();
            Some(entry.config_id)
        } else {
            None
        }
    }

    /// Get full session entry
    pub fn get_entry(&self, session_id: &str) -> Option<SessionConfigEntry> {
        let map = self.map.read().unwrap();
        map.get(session_id).cloned()
    }

    /// Remove a session (called when terminal closes)
    pub fn remove(&self, session_id: &str) -> Option<SessionConfigEntry> {
        let mut map = self.map.write().unwrap();
        let removed = map.remove(session_id);
        if removed.is_some() {
            log::debug!("Session removed: {}", session_id);
        }
        removed
    }

    /// List all active sessions
    pub fn list_sessions(&self) -> Vec<(String, SessionConfigEntry)> {
        let map = self.map.read().unwrap();
        map.iter()
            .map(|(k, v)| (k.clone(), v.clone()))
            .collect()
    }

    /// Get count of active sessions
    pub fn session_count(&self) -> usize {
        let map = self.map.read().unwrap();
        map.len()
    }

    /// Check if a session exists
    pub fn has_session(&self, session_id: &str) -> bool {
        let map = self.map.read().unwrap();
        map.contains_key(session_id)
    }

    /// Clean up stale sessions (not used for more than `max_age` duration)
    ///
    /// # Arguments
    /// - `max_age`: Maximum age in seconds before a session is considered stale
    ///
    /// # Returns
    /// - Number of sessions removed
    pub fn cleanup_stale_sessions(&self, max_age_secs: i64) -> usize {
        let mut map = self.map.write().unwrap();
        let now = Utc::now();
        let before_count = map.len();

        map.retain(|session_id, entry| {
            let age = now.signed_duration_since(entry.last_used_at).num_seconds();
            if age > max_age_secs {
                log::debug!("Cleaning up stale session: {} (age: {}s)", session_id, age);
                false
            } else {
                true
            }
        });

        before_count - map.len()
    }

    /// Clear all sessions (used on proxy restart)
    pub fn clear(&self) {
        let mut map = self.map.write().unwrap();
        map.clear();
        log::debug!("All sessions cleared");
    }
}

impl Default for SessionConfigMap {
    fn default() -> Self {
        Self::new()
    }
}

// Global singleton instance
lazy_static::lazy_static! {
    /// Global session config map instance
    ///
    /// This is the primary interface for session-based routing.
    /// Used by proxy server to determine which API config to use for each request.
    pub static ref SESSION_CONFIG_MAP: SessionConfigMap = SessionConfigMap::new();
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_register_and_get() {
        let map = SessionConfigMap::new();
        map.register("session_1".to_string(), 42, Some("Test Session".to_string()));

        assert_eq!(map.get_config_id("session_1"), Some(42));
        assert_eq!(map.get_config_id("session_2"), None);
    }

    #[test]
    fn test_switch() {
        let map = SessionConfigMap::new();
        map.register("session_1".to_string(), 42, None);

        assert!(map.switch("session_1", 100));
        assert_eq!(map.get_config_id("session_1"), Some(100));

        assert!(!map.switch("nonexistent", 200));
    }

    #[test]
    fn test_remove() {
        let map = SessionConfigMap::new();
        map.register("session_1".to_string(), 42, None);

        assert!(map.has_session("session_1"));
        map.remove("session_1");
        assert!(!map.has_session("session_1"));
    }

    #[test]
    fn test_list_sessions() {
        let map = SessionConfigMap::new();
        map.register("session_1".to_string(), 1, None);
        map.register("session_2".to_string(), 2, None);

        let sessions = map.list_sessions();
        assert_eq!(sessions.len(), 2);
    }
}
