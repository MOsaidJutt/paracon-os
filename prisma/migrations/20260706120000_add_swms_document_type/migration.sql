-- Adds SWMS as a fourth DocumentTemplateType so the General Fitout SWMS can be
-- generated through the same auto-filled/versioned template engine as the
-- Tender Letter, Variation and Progress Claim, instead of only existing as a
-- static uploaded file.
ALTER TYPE "DocumentTemplateType" ADD VALUE 'SWMS';
