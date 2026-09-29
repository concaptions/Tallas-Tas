ALTER TYPE "awareness_stage" ADD VALUE IF NOT EXISTS 'unaware_to_problem_aware' AFTER 'unaware';
--> statement-breakpoint
ALTER TYPE "awareness_stage" ADD VALUE IF NOT EXISTS 'problem_aware_to_solution_aware' AFTER 'problem_aware';
