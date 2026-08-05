-- CreateTable
CREATE TABLE "makes" (
    "make_id" INTEGER NOT NULL,
    "make_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "makes_pkey" PRIMARY KEY ("make_id")
);

-- CreateTable
CREATE TABLE "vehicle_types" (
    "make_id" INTEGER NOT NULL,
    "type_id" INTEGER NOT NULL,
    "type_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicle_types_pkey" PRIMARY KEY ("make_id","type_id")
);

-- AddForeignKey
ALTER TABLE "vehicle_types" ADD CONSTRAINT "vehicle_types_make_id_fkey" FOREIGN KEY ("make_id") REFERENCES "makes"("make_id") ON DELETE RESTRICT ON UPDATE CASCADE;
