CREATE TABLE "saved_meal_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meal_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"food_id" uuid,
	"name" text NOT NULL,
	"brand" text,
	"grams" real,
	"kcal" real NOT NULL,
	"protein" real NOT NULL,
	"carbs" real NOT NULL,
	"fat" real NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_meal" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "saved_meal_item" ADD CONSTRAINT "saved_meal_item_meal_id_saved_meal_id_fk" FOREIGN KEY ("meal_id") REFERENCES "public"."saved_meal"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_meal_item" ADD CONSTRAINT "saved_meal_item_food_id_food_id_fk" FOREIGN KEY ("food_id") REFERENCES "public"."food"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_meal" ADD CONSTRAINT "saved_meal_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "saved_meal_item_meal_id_idx" ON "saved_meal_item" USING btree ("meal_id");--> statement-breakpoint
CREATE INDEX "saved_meal_user_id_idx" ON "saved_meal" USING btree ("user_id");