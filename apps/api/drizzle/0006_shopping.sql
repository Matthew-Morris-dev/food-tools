CREATE TYPE "public"."store" AS ENUM('tesco', 'sainsburys', 'ocado');--> statement-breakpoint
CREATE TABLE "shopping_item_pref" (
	"user_id" text NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"aisle" text,
	"pack_grams" real,
	"in_pantry" boolean DEFAULT false NOT NULL,
	CONSTRAINT "shopping_item_pref_user_id_key_pk" PRIMARY KEY("user_id","key")
);
--> statement-breakpoint
CREATE TABLE "shopping_manual_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"week_start" date NOT NULL,
	"name" text NOT NULL,
	"aisle" text,
	"ticked" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shopping_tick" (
	"user_id" text NOT NULL,
	"week_start" date NOT NULL,
	"key" text NOT NULL,
	"ticked" boolean NOT NULL,
	CONSTRAINT "shopping_tick_user_id_week_start_key_pk" PRIMARY KEY("user_id","week_start","key")
);
--> statement-breakpoint
CREATE TABLE "store_product" (
	"user_id" text NOT NULL,
	"key" text NOT NULL,
	"store" "store" NOT NULL,
	"url" text NOT NULL,
	CONSTRAINT "store_product_user_id_key_store_pk" PRIMARY KEY("user_id","key","store")
);
--> statement-breakpoint
ALTER TABLE "shopping_item_pref" ADD CONSTRAINT "shopping_item_pref_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_manual_item" ADD CONSTRAINT "shopping_manual_item_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_tick" ADD CONSTRAINT "shopping_tick_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_product" ADD CONSTRAINT "store_product_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "shopping_manual_item_user_week_idx" ON "shopping_manual_item" USING btree ("user_id","week_start");