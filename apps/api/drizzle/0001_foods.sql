CREATE TYPE "public"."food_source" AS ENUM('cofid', 'off', 'custom');--> statement-breakpoint
CREATE TYPE "public"."log_status" AS ENUM('planned', 'eaten');--> statement-breakpoint
CREATE TYPE "public"."meal_slot" AS ENUM('breakfast', 'lunch', 'dinner', 'snack');--> statement-breakpoint
CREATE TABLE "food_log_entry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"date" date NOT NULL,
	"slot" "meal_slot" NOT NULL,
	"status" "log_status" DEFAULT 'eaten' NOT NULL,
	"food_id" uuid,
	"name" text NOT NULL,
	"brand" text,
	"grams" real,
	"kcal" real NOT NULL,
	"protein" real NOT NULL,
	"carbs" real NOT NULL,
	"fat" real NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "food" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" "food_source" NOT NULL,
	"source_id" text,
	"owner_id" text,
	"name" text NOT NULL,
	"brand" text,
	"barcode" text,
	"kcal" real NOT NULL,
	"protein" real NOT NULL,
	"carbs" real NOT NULL,
	"fat" real NOT NULL,
	"sugars" real,
	"fibre" real,
	"saturates" real,
	"salt" real,
	"servings" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "food_log_entry" ADD CONSTRAINT "food_log_entry_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "food_log_entry" ADD CONSTRAINT "food_log_entry_food_id_food_id_fk" FOREIGN KEY ("food_id") REFERENCES "public"."food"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "food" ADD CONSTRAINT "food_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "food_log_entry_user_date_idx" ON "food_log_entry" USING btree ("user_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "food_source_source_id_idx" ON "food" USING btree ("source","source_id");--> statement-breakpoint
CREATE INDEX "food_barcode_idx" ON "food" USING btree ("barcode");--> statement-breakpoint
CREATE INDEX "food_owner_id_idx" ON "food" USING btree ("owner_id");