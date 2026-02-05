-- File: backend/src/prisma/migrations/20260205161326_add_ielts_domain_config/migration.sql
-- Purpose: Add versioned IELTS domain configuration tables
-- Why: Move hardcoded frontend constants to backend database for dynamic configuration

-- Version tracking for IELTS config
CREATE TABLE ielts_config_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version INTEGER NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  activated_at TIMESTAMPTZ
);

-- Assignment types (reading, listening, writing, speaking)
CREATE TABLE ielts_assignment_types (
  id TEXT NOT NULL,
  config_version INTEGER NOT NULL REFERENCES ielts_config_versions(version) ON DELETE CASCADE,
  label TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  enabled BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (id, config_version)
);

-- Question types for reading and listening
CREATE TABLE ielts_question_types (
  id TEXT NOT NULL,
  config_version INTEGER NOT NULL REFERENCES ielts_config_versions(version) ON DELETE CASCADE,
  skill_type TEXT NOT NULL CHECK (skill_type IN ('reading', 'listening')),
  label TEXT NOT NULL,
  description TEXT,
  enabled BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (id, config_version, skill_type)
);

-- Writing task types (Task 1 and Task 2)
CREATE TABLE ielts_writing_task_types (
  id TEXT NOT NULL,
  config_version INTEGER NOT NULL REFERENCES ielts_config_versions(version) ON DELETE CASCADE,
  task_number INTEGER NOT NULL CHECK (task_number IN (1, 2)),
  label TEXT NOT NULL,
  description TEXT,
  enabled BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (id, config_version, task_number)
);

-- Speaking part types
CREATE TABLE ielts_speaking_part_types (
  id TEXT NOT NULL,
  config_version INTEGER NOT NULL REFERENCES ielts_config_versions(version) ON DELETE CASCADE,
  label TEXT NOT NULL,
  description TEXT,
  enabled BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (id, config_version)
);

-- Completion formats (form, note, table, etc.)
CREATE TABLE ielts_completion_formats (
  id TEXT NOT NULL,
  config_version INTEGER NOT NULL REFERENCES ielts_config_versions(version) ON DELETE CASCADE,
  label TEXT NOT NULL,
  description TEXT,
  enabled BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (id, config_version)
);

-- Sample timing options
CREATE TABLE ielts_sample_timing_options (
  id TEXT NOT NULL,
  config_version INTEGER NOT NULL REFERENCES ielts_config_versions(version) ON DELETE CASCADE,
  label TEXT NOT NULL,
  description TEXT,
  enabled BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (id, config_version)
);

-- Seed initial version (v1) with current hardcoded values
INSERT INTO ielts_config_versions (version, name, description, is_active, activated_at)
VALUES (1, 'Initial', 'First IELTS configuration version', true, NOW());

-- Seed assignment types
INSERT INTO ielts_assignment_types (id, config_version, label, description, icon, sort_order) VALUES
('reading', 1, 'Reading', 'Reading comprehension test', 'book-open', 1),
('listening', 1, 'Listening', 'Listening comprehension test', 'headphones', 2),
('writing', 1, 'Writing', 'Writing test with Task 1 and Task 2', 'pen-tool', 3),
('speaking', 1, 'Speaking', 'Speaking test with three parts', 'mic', 4);

-- Seed reading question types
INSERT INTO ielts_question_types (id, config_version, skill_type, label, sort_order) VALUES
('multiple_choice', 1, 'reading', 'Multiple Choice', 1),
('true_false_not_given', 1, 'reading', 'True/False/Not Given', 2),
('yes_no_not_given', 1, 'reading', 'Yes/No/Not Given', 3),
('matching_headings', 1, 'reading', 'Matching Headings', 4),
('matching_information', 1, 'reading', 'Matching Information', 5),
('matching_features', 1, 'reading', 'Matching Features', 6),
('sentence_completion', 1, 'reading', 'Sentence Completion', 7),
('completion', 1, 'reading', 'Completion (Form/Note/Table/etc.)', 8),
('diagram_labeling', 1, 'reading', 'Diagram Labeling', 9),
('short_answer', 1, 'reading', 'Short Answer', 10);

-- Seed listening question types
INSERT INTO ielts_question_types (id, config_version, skill_type, label, sort_order) VALUES
('multiple_choice', 1, 'listening', 'Multiple Choice', 1),
('matching', 1, 'listening', 'Matching', 2),
('map_diagram_labeling', 1, 'listening', 'Map/Diagram Labeling', 3),
('completion', 1, 'listening', 'Completion (Form/Note/Table/etc.)', 4),
('sentence_completion', 1, 'listening', 'Sentence Completion', 5),
('short_answer', 1, 'listening', 'Short Answer', 6);

-- Seed writing task 1 types
INSERT INTO ielts_writing_task_types (id, config_version, task_number, label, sort_order) VALUES
('line_graph', 1, 1, 'Line Graph', 1),
('bar_chart', 1, 1, 'Bar Chart', 2),
('pie_chart', 1, 1, 'Pie Chart', 3),
('table', 1, 1, 'Table', 4),
('diagram', 1, 1, 'Diagram', 5),
('map', 1, 1, 'Map', 6),
('process', 1, 1, 'Process', 7);

-- Seed writing task 2 types
INSERT INTO ielts_writing_task_types (id, config_version, task_number, label, sort_order) VALUES
('opinion', 1, 2, 'Opinion Essay', 1),
('discussion', 1, 2, 'Discussion Essay', 2),
('problem_solution', 1, 2, 'Problem-Solution Essay', 3),
('advantages_disadvantages', 1, 2, 'Advantages & Disadvantages Essay', 4),
('double_question', 1, 2, 'Double Question Essay', 5);

-- Seed speaking part types
INSERT INTO ielts_speaking_part_types (id, config_version, label, sort_order) VALUES
('part1_personal', 1, 'Part 1: Personal Questions', 1),
('part2_cue_card', 1, 'Part 2: Cue Card', 2),
('part3_discussion', 1, 'Part 3: Discussion', 3);

-- Seed completion formats
INSERT INTO ielts_completion_formats (id, config_version, label, sort_order) VALUES
('form', 1, 'Form Completion', 1),
('note', 1, 'Note Completion', 2),
('table', 1, 'Table Completion', 3),
('flow_chart', 1, 'Flow Chart Completion', 4),
('summary', 1, 'Summary Completion', 5);

-- Seed sample timing options
INSERT INTO ielts_sample_timing_options (id, config_version, label, description, sort_order) VALUES
('immediate', 1, 'Immediately', 'Show sample response immediately', 1),
('after_submission', 1, 'After student submits', 'Show after student submits their work', 2),
('after_grading', 1, 'After grading is complete', 'Show after teacher grades the submission', 3),
('specific_date', 1, 'On a specific date', 'Show on a specific date and time', 4);
