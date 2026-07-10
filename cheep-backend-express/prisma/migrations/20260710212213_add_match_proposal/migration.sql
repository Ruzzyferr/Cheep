-- CreateTable
CREATE TABLE "match_proposals" (
    "id" SERIAL NOT NULL,
    "country_id" INTEGER NOT NULL,
    "product_id" INTEGER NOT NULL,
    "candidate_product_id" INTEGER NOT NULL,
    "similarity" DOUBLE PRECISION NOT NULL,
    "evidence" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "match_proposals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "match_proposals_status_idx" ON "match_proposals"("status");

-- CreateIndex
CREATE INDEX "match_proposals_country_id_idx" ON "match_proposals"("country_id");

-- CreateIndex
CREATE UNIQUE INDEX "match_proposals_product_id_candidate_product_id_key" ON "match_proposals"("product_id", "candidate_product_id");
