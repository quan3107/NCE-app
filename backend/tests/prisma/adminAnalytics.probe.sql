-- Admin analytics policy probe: disposable rows roll back after real role-bound checks.
BEGIN;
INSERT INTO users(id, email, full_name, role, status, "updatedAt") VALUES
 ('fd070000-0000-4000-8000-000000000001', 'analytics-probe@example.invalid', 'Analytics probe', 'student', 'active', now());
INSERT INTO courses(id, title, owner_teacher_id, "updatedAt") VALUES
 ('fd070000-0000-4000-8000-000000000002', 'Analytics policy probe', 'fd070000-0000-4000-8000-000000000001', now());
DO $$ BEGIN
 IF has_table_privilege('anon', 'learning_activity_days', 'SELECT') OR
    has_table_privilege('authenticated', 'learning_activity_days', 'INSERT') OR
    has_table_privilege('nce_app_anon', 'learning_activity_days', 'SELECT') THEN
   RAISE EXCEPTION 'Activity leaked to a public/Data API role';
 END IF;
 IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='learning_activity_days'::regclass) THEN
   RAISE EXCEPTION 'Activity RLS is disabled';
 END IF;
END $$;
SET LOCAL ROLE nce_app_authenticated;
SELECT set_config('app.current_user_role', 'student', true),
 set_config('app.current_user_id', 'fd070000-0000-4000-8000-000000000001', true);
INSERT INTO learning_activity_days(student_id, course_id)
 VALUES ('fd070000-0000-4000-8000-000000000001', 'fd070000-0000-4000-8000-000000000002');
INSERT INTO learning_activity_days(student_id, course_id)
 VALUES ('fd070000-0000-4000-8000-000000000001', 'fd070000-0000-4000-8000-000000000002') ON CONFLICT DO NOTHING;
DO $$ BEGIN
 IF (SELECT count(*) FROM learning_activity_days WHERE course_id='fd070000-0000-4000-8000-000000000002') <> 1 THEN
   RAISE EXCEPTION 'Daily deduplication failed';
 END IF;
 BEGIN
   INSERT INTO learning_activity_days(student_id, course_id, day)
   VALUES ('fd070000-0000-4000-8000-000000000001', 'fd070000-0000-4000-8000-000000000002', CURRENT_DATE - 1);
   RAISE EXCEPTION 'Backdated activity accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 PERFORM set_config('app.current_user_id', 'fd070000-0000-4000-8000-000000000003', true);
 IF EXISTS (SELECT 1 FROM learning_activity_days WHERE course_id='fd070000-0000-4000-8000-000000000002') THEN
   RAISE EXCEPTION 'Another student can read activity';
 END IF;
 BEGIN
   INSERT INTO learning_activity_days(student_id, course_id)
   VALUES ('fd070000-0000-4000-8000-000000000001', 'fd070000-0000-4000-8000-000000000002');
   RAISE EXCEPTION 'Another student can write activity';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 PERFORM set_config('app.current_user_role', 'teacher', true);
 IF EXISTS (SELECT 1 FROM learning_activity_days WHERE course_id='fd070000-0000-4000-8000-000000000002') THEN
   RAISE EXCEPTION 'Teacher can read student activity';
 END IF;
 PERFORM set_config('app.current_user_role', 'admin', true);
 IF (SELECT count(*) FROM learning_activity_days WHERE course_id='fd070000-0000-4000-8000-000000000002') <> 1 THEN
   RAISE EXCEPTION 'Admin cannot read activity';
 END IF;
END $$;
ROLLBACK;
