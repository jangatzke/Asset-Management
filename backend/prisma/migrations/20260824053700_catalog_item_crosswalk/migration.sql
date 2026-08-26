-- Add crosswalk column to control_catalog_items for NIS2 obligation <-> ISO 27001 crosswalks

-- AlterTable
ALTER TABLE "control_catalog_items" ADD COLUMN     "crosswalk" TEXT[] DEFAULT '{}';
