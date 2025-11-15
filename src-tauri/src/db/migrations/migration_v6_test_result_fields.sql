-- Migration: v5 -> v6
-- 目的: 为 TestResult 表添加缺失的字段
-- 日期: 2025-11-15
-- 说明: 添加 response_text, test_model, attempt 字段以支持更详细的测试结果记录

-- 1. 添加 response_text 字段（API 响应内容）
ALTER TABLE TestResult ADD COLUMN response_text TEXT;

-- 2. 添加 test_model 字段（测试使用的模型）
ALTER TABLE TestResult ADD COLUMN test_model TEXT;

-- 3. 添加 attempt 字段（尝试次数）
ALTER TABLE TestResult ADD COLUMN attempt INTEGER DEFAULT 1;
