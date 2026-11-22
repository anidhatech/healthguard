-- CreateEnum
CREATE TYPE "QueueEntryStatus" AS ENUM ('ACTIVE', 'CLOSED');

-- CreateTable
CREATE TABLE "Counter" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Counter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QueueEntry" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "counterId" UUID NOT NULL,
    "patientProfileId" UUID NOT NULL,
    "serviceDate" DATE NOT NULL,
    "tokenNumber" INTEGER NOT NULL,
    "status" "QueueEntryStatus" NOT NULL DEFAULT 'ACTIVE',
    "source" TEXT NOT NULL DEFAULT 'ABDM_SHARE',
    "lastShareRequestId" TEXT,
    "replyStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "tokenExpiresAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "closedAt" TIMESTAMPTZ(3),

    CONSTRAINT "QueueEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Counter_organizationId_id_key" ON "Counter"("organizationId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Counter_organizationId_code_key" ON "Counter"("organizationId", "code");

-- CreateIndex
CREATE INDEX "QueueEntry_organizationId_counterId_status_idx" ON "QueueEntry"("organizationId", "counterId", "status");

-- CreateIndex
CREATE INDEX "QueueEntry_organizationId_patientProfileId_idx" ON "QueueEntry"("organizationId", "patientProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "QueueEntry_organizationId_id_key" ON "QueueEntry"("organizationId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "QueueEntry_organizationId_counterId_serviceDate_tokenNumber_key" ON "QueueEntry"("organizationId", "counterId", "serviceDate", "tokenNumber");

-- AddForeignKey
ALTER TABLE "Counter" ADD CONSTRAINT "Counter_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QueueEntry" ADD CONSTRAINT "QueueEntry_organizationId_counterId_fkey" FOREIGN KEY ("organizationId", "counterId") REFERENCES "Counter"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QueueEntry" ADD CONSTRAINT "QueueEntry_organizationId_patientProfileId_fkey" FOREIGN KEY ("organizationId", "patientProfileId") REFERENCES "PatientProfile"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- A patient waits at most once at a counter: a repeat scan reuses the active entry.
CREATE UNIQUE INDEX "QueueEntry_one_active_per_counter_patient" ON "QueueEntry"("organizationId", "counterId", "patientProfileId") WHERE "status" = 'ACTIVE';
