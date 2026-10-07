CREATE TYPE "public"."activity_level" AS ENUM('sedentary', 'light', 'moderate', 'active', 'very_active');--> statement-breakpoint
CREATE TYPE "public"."goal_reason" AS ENUM('setup', 'edit', 'check_in');--> statement-breakpoint
CREATE TYPE "public"."goal_type" AS ENUM('lose', 'maintain', 'gain', 'build');--> statement-breakpoint
CREATE TYPE "public"."height_unit" AS ENUM('cm', 'ft_in');--> statement-breakpoint
CREATE TYPE "public"."sex" AS ENUM('male', 'female', 'unspecified');--> statement-breakpoint
CREATE TYPE "public"."weight_unit" AS ENUM('kg', 'st_lb', 'lb');--> statement-breakpoint
CREATE TABLE "check_in" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"date" date NOT NULL,
	"observed_rate_kg" real,
	"suggested_kcal" real,
	"accepted" boolean NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "day" (
	"user_id" text NOT NULL,
	"date" date NOT NULL,
	"training_day" boolean,
	CONSTRAINT "day_user_id_date_pk" PRIMARY KEY("user_id","date")
);
--> statement-breakpoint
CREATE TABLE "exercise_entry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"date" date NOT NULL,
	"activity" text NOT NULL,
	"minutes" integer NOT NULL,
	"kcal" real NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "goal" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"type" "goal_type" NOT NULL,
	"rate_per_week_kg" real DEFAULT 0 NOT NULL,
	"start_weight_kg" real NOT NULL,
	"target_weight_kg" real,
	"kcal" real NOT NULL,
	"protein" real NOT NULL,
	"carbs" real NOT NULL,
	"fat" real NOT NULL,
	"manual" boolean DEFAULT false NOT NULL,
	"training_weekdays" integer[] DEFAULT '{}' NOT NULL,
	"training_day_extra_kcal" real DEFAULT 200 NOT NULL,
	"exercise_adds_to_allowance" boolean DEFAULT false NOT NULL,
	"active_from" date NOT NULL,
	"reason" "goal_reason" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profile" (
	"user_id" text PRIMARY KEY NOT NULL,
	"birth_year" integer NOT NULL,
	"sex" "sex" NOT NULL,
	"height_cm" real NOT NULL,
	"activity_level" "activity_level" NOT NULL,
	"weight_unit" "weight_unit" DEFAULT 'kg' NOT NULL,
	"height_unit" "height_unit" DEFAULT 'cm' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "weight_entry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"date" date NOT NULL,
	"weight_kg" real NOT NULL
);
--> statement-breakpoint
ALTER TABLE "check_in" ADD CONSTRAINT "check_in_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "day" ADD CONSTRAINT "day_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_entry" ADD CONSTRAINT "exercise_entry_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal" ADD CONSTRAINT "goal_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile" ADD CONSTRAINT "profile_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weight_entry" ADD CONSTRAINT "weight_entry_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "check_in_user_date_idx" ON "check_in" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "exercise_entry_user_date_idx" ON "exercise_entry" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "goal_user_active_from_idx" ON "goal" USING btree ("user_id","active_from");--> statement-breakpoint
CREATE UNIQUE INDEX "weight_entry_user_date_idx" ON "weight_entry" USING btree ("user_id","date");