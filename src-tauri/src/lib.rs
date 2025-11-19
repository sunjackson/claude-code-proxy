// Library exports for testing and reusability
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
#![allow(dead_code)]

// Database modules
pub mod db;

// Model modules
pub mod models;

// Service modules
pub mod services;

// Utility modules
pub mod utils;

// Command modules
pub mod commands;

// Proxy module
pub mod proxy;

// Converters module (API格式转换)
pub mod converters;

// Tray module
pub mod tray;
