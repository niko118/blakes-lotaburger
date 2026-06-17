ALTER TABLE "report_groups" ADD COLUMN "contributes_as" varchar(20);--> statement-breakpoint
ALTER TABLE "report_groups" ADD COLUMN "eliminate_commissary" boolean DEFAULT false NOT NULL;