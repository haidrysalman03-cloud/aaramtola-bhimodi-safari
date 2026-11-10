CREATE TABLE "safari_content" (
	"id" text PRIMARY KEY,
	"data" jsonb NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" text NOT NULL
);
