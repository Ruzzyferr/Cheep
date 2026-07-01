-- CreateTable
CREATE TABLE "store_branches" (
    "id" SERIAL NOT NULL,
    "store_id" INTEGER NOT NULL,
    "country_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lon" DOUBLE PRECISION NOT NULL,
    "address" TEXT,
    "city" TEXT,
    "source" TEXT NOT NULL,
    "external_ref" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "store_branches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "store_branches_external_ref_key" ON "store_branches"("external_ref");

-- CreateIndex
CREATE INDEX "store_branches_country_id_idx" ON "store_branches"("country_id");

-- CreateIndex
CREATE INDEX "store_branches_store_id_idx" ON "store_branches"("store_id");

-- CreateIndex
CREATE INDEX "store_branches_lat_lon_idx" ON "store_branches"("lat", "lon");

-- AddForeignKey
ALTER TABLE "store_branches" ADD CONSTRAINT "store_branches_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_branches" ADD CONSTRAINT "store_branches_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "countries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
