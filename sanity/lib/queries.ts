import { sanityClient } from "./client";

// ============================================================
// Typed GROQ Queries for Sanity Content
// ============================================================

export async function fetchAllQmDocuments() {
  return sanityClient.fetch(
    `*[_type == "qmDocument"] | order(chapterNumber asc) {
      _id, title, slug, chapterNumber, category,
      effectiveDate, lastReviewDate
    }`
  );
}

export async function fetchQmDocumentBySlug(slug: string) {
  return sanityClient.fetch(
    `*[_type == "qmDocument" && slug.current == $slug][0] {
      _id, title, slug, chapterNumber, category,
      content, relatedDocuments[]->{ _id, title, chapterNumber },
      effectiveDate, lastReviewDate
    }`,
    { slug }
  );
}

export async function fetchAllWorkInstructions() {
  return sanityClient.fetch(
    `*[_type == "workInstruction"] | order(documentCode asc) {
      _id, title, slug, documentCode, scope, targetRoles,
      effectiveDate, lastReviewDate
    }`
  );
}

export async function fetchAllFormTemplates() {
  return sanityClient.fetch(
    `*[_type == "formTemplate"] | order(formCode asc) {
      _id, title, slug, formCode, purpose,
      "templateFileUrl": templateFile.asset->url,
      effectiveDate
    }`
  );
}

export async function fetchAllProcessDescriptions() {
  return sanityClient.fetch(
    `*[_type == "processDescription"] | order(processCode asc) {
      _id, title, slug, processCode, processOwner,
      kpis
    }`
  );
}

/** Search across all document types */
export async function searchDocuments(searchTerm: string) {
  return sanityClient.fetch(
    `*[_type in ["qmDocument", "workInstruction", "formTemplate", "processDescription"]
      && (title match $search || documentCode match $search || formCode match $search || processCode match $search)] {
      _id, _type, title,
      "code": coalesce(chapterNumber, documentCode, formCode, processCode)
    }`,
    { search: `${searchTerm}*` }
  );
}
