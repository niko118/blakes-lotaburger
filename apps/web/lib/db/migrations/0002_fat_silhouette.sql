CREATE TABLE "account_mappings" (
	"id" serial PRIMARY KEY NOT NULL,
	"account_name" varchar(500) NOT NULL,
	"group_id" integer,
	"ignored" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "account_mappings_account_name_unique" UNIQUE("account_name")
);
--> statement-breakpoint
CREATE TABLE "report_groups" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"parent_id" integer,
	"report_type" varchar(20) NOT NULL,
	"sort_order" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "account_mappings_account_name_idx" ON "account_mappings" USING btree ("account_name");--> statement-breakpoint
CREATE INDEX "account_mappings_group_id_idx" ON "account_mappings" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "report_groups_report_type_idx" ON "report_groups" USING btree ("report_type");--> statement-breakpoint
CREATE INDEX "report_groups_parent_id_idx" ON "report_groups" USING btree ("parent_id");