export interface PostTargetsPageDto {
  id: number;
  title: { en?: string; km?: string } | string | null;
  slug: string;
}

export interface PostTargetsSectionDto {
  id: number;
  title: { en?: string; km?: string };
  blockType: string;
  allowedCategoryIds: number[];
}

export interface PostTargetsResponseDto {
  workingGroupId: number;
  pageId: number | null;
  page: PostTargetsPageDto | null;
  sections: PostTargetsSectionDto[];
}
