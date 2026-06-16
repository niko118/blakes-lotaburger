CREATE TABLE "api_credentials" (
	"id" serial PRIMARY KEY NOT NULL,
	"integration_id" varchar(100) NOT NULL,
	"integration_name" varchar(255),
	"refresh_token_encrypted" text NOT NULL,
	"refresh_token_fingerprint" varchar(64),
	"refresh_expires_at" timestamp,
	"access_token_encrypted" text,
	"access_expires_at" timestamp,
	"last_access_ttl_seconds" integer,
	"last_refreshed_at" timestamp,
	"rotated_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "api_credentials_integration_id_unique" UNIQUE("integration_id")
);
--> statement-breakpoint
CREATE TABLE "app_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"permissions" jsonb DEFAULT '[]' NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "app_roles_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "app_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"name" varchar(255),
	"password_hash" varchar(255),
	"is_admin" boolean DEFAULT false NOT NULL,
	"role_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_login_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "app_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE INDEX "api_credentials_integration_id_idx" ON "api_credentials" USING btree ("integration_id");--> statement-breakpoint
CREATE INDEX "app_roles_name_idx" ON "app_roles" USING btree ("name");--> statement-breakpoint
CREATE INDEX "app_roles_is_system_idx" ON "app_roles" USING btree ("is_system");--> statement-breakpoint
CREATE INDEX "app_users_email_idx" ON "app_users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "app_users_role_id_idx" ON "app_users" USING btree ("role_id");