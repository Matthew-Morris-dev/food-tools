CREATE TYPE "public"."recipe_preference" AS ENUM('like', 'neutral', 'dislike');--> statement-breakpoint
CREATE TABLE "meal_plan_entry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"date" date NOT NULL,
	"slot" "meal_slot" NOT NULL,
	"recipe_id" uuid,
	"food_id" uuid,
	"servings" real,
	"grams" real,
	"leftover_of_id" uuid,
	"locked" boolean DEFAULT false NOT NULL,
	"log_entry_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "meal_plan_entry_one_item" CHECK (("meal_plan_entry"."recipe_id" IS NULL) <> ("meal_plan_entry"."food_id" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "plan_template_entry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" uuid NOT NULL,
	"day_offset" integer NOT NULL,
	"slot" "meal_slot" NOT NULL,
	"recipe_id" uuid,
	"food_id" uuid,
	"servings" real,
	"grams" real,
	"leftover_of_id" uuid,
	"locked" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plan_template" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "planner_settings" (
	"user_id" text PRIMARY KEY NOT NULL,
	"diets" text[] DEFAULT '{}' NOT NULL,
	"excluded_words" text[] DEFAULT '{}' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "recipe" ADD COLUMN "slots" text[] DEFAULT '{"lunch","dinner"}' NOT NULL;--> statement-breakpoint
ALTER TABLE "recipe" ADD COLUMN "preference" "recipe_preference" DEFAULT 'neutral' NOT NULL;--> statement-breakpoint
ALTER TABLE "meal_plan_entry" ADD CONSTRAINT "meal_plan_entry_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_plan_entry" ADD CONSTRAINT "meal_plan_entry_recipe_id_recipe_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipe"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_plan_entry" ADD CONSTRAINT "meal_plan_entry_food_id_food_id_fk" FOREIGN KEY ("food_id") REFERENCES "public"."food"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_plan_entry" ADD CONSTRAINT "meal_plan_entry_leftover_of_id_meal_plan_entry_id_fk" FOREIGN KEY ("leftover_of_id") REFERENCES "public"."meal_plan_entry"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_plan_entry" ADD CONSTRAINT "meal_plan_entry_log_entry_id_food_log_entry_id_fk" FOREIGN KEY ("log_entry_id") REFERENCES "public"."food_log_entry"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_template_entry" ADD CONSTRAINT "plan_template_entry_template_id_plan_template_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."plan_template"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_template_entry" ADD CONSTRAINT "plan_template_entry_recipe_id_recipe_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipe"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_template_entry" ADD CONSTRAINT "plan_template_entry_food_id_food_id_fk" FOREIGN KEY ("food_id") REFERENCES "public"."food"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_template_entry" ADD CONSTRAINT "plan_template_entry_leftover_of_id_plan_template_entry_id_fk" FOREIGN KEY ("leftover_of_id") REFERENCES "public"."plan_template_entry"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_template" ADD CONSTRAINT "plan_template_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planner_settings" ADD CONSTRAINT "planner_settings_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "meal_plan_entry_user_date_idx" ON "meal_plan_entry" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "plan_template_entry_template_id_idx" ON "plan_template_entry" USING btree ("template_id");--> statement-breakpoint
CREATE INDEX "plan_template_user_id_idx" ON "plan_template" USING btree ("user_id");