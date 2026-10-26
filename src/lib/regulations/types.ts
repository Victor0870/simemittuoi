export type RegulationDocument = {
  id: string;
  title: string;
  year: number;
  status: "active" | "draft" | "archived";
  document_number: string | null;
  issue_date: string | null;
  preamble: string | null;
  created_at: string;
  updated_at: string;
};

export type RegulationSection = {
  id: string;
  document_id: string;
  order: number;
  order_index: number;
  chapter: string;
  article_number: string;
  heading: string;
  body_text: string;
  created_at: string;
  updated_at: string;
  updated_by: string | null;
};

export type RegulationWithSections = RegulationDocument & {
  sections: RegulationSection[];
};
