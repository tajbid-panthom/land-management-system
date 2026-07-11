import { pgTable, uuid, varchar, timestamp } from "drizzle-orm/pg-core";
import { geometry } from "./geometry";

export const divisions = pgTable("divisions", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 100 }).notNull(),
  nameBn: varchar("name_bn", { length: 100 }),
  code: varchar("code", { length: 20 }).notNull().unique(),
});

export const districts = pgTable("districts", {
  id: uuid("id").primaryKey().defaultRandom(),
  divisionId: uuid("division_id").references(() => divisions.id),
  name: varchar("name", { length: 100 }).notNull(),
  nameBn: varchar("name_bn", { length: 100 }),
  code: varchar("code", { length: 20 }).notNull().unique(),
});

export const upazilas = pgTable("upazilas", {
  id: uuid("id").primaryKey().defaultRandom(),
  districtId: uuid("district_id")
    .references(() => districts.id)
    .notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  nameBn: varchar("name_bn", { length: 100 }),
  code: varchar("code", { length: 20 }).notNull(),
});

export const unions = pgTable("unions", {
  id: uuid("id").primaryKey().defaultRandom(),
  upazilaId: uuid("upazila_id")
    .references(() => upazilas.id)
    .notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  type: varchar("type", { length: 30 }).notNull(),
  code: varchar("code", { length: 20 }),
});

export const mouzas = pgTable("mouzas", {
  id: uuid("id").primaryKey().defaultRandom(),
  unionId: uuid("union_id").references(() => unions.id),
  upazilaId: uuid("upazila_id").references(() => upazilas.id),
  name: varchar("name", { length: 100 }).notNull(),
  nameBn: varchar("name_bn", { length: 100 }),
  jlNumber: varchar("jl_number", { length: 20 }).notNull(),
  mCode: varchar("m_code", { length: 50 }),
  datasetId: uuid("dataset_id"),
  boundary: geometry("boundary"),
  createdAt: timestamp("created_at").defaultNow(),
});
