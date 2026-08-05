/*
  Warnings:

  - The primary key for the `vehicle_types` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `make_id` on the `vehicle_types` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "vehicle_types" DROP CONSTRAINT "vehicle_types_make_id_fkey";

-- AlterTable
ALTER TABLE "vehicle_types" DROP CONSTRAINT "vehicle_types_pkey",
DROP COLUMN "make_id",
ADD CONSTRAINT "vehicle_types_pkey" PRIMARY KEY ("type_id");

-- CreateTable
CREATE TABLE "make_vehicle_types" (
    "makeId" INTEGER NOT NULL,
    "typeId" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "make_vehicle_types_pkey" PRIMARY KEY ("makeId","typeId")
);

-- AddForeignKey
ALTER TABLE "make_vehicle_types" ADD CONSTRAINT "make_vehicle_types_makeId_fkey" FOREIGN KEY ("makeId") REFERENCES "makes"("make_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "make_vehicle_types" ADD CONSTRAINT "make_vehicle_types_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "vehicle_types"("type_id") ON DELETE RESTRICT ON UPDATE CASCADE;
