export enum CampaignStatus {
  PLANNED = 'PLANNED',
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export const CAMPAIGN_STATUS_LABELS: Record<CampaignStatus, string> = {
  [CampaignStatus.PLANNED]: 'Planned & Scheduled',
  [CampaignStatus.ACTIVE]: 'Active (In Progress)',
  [CampaignStatus.COMPLETED]: 'Completed',
  [CampaignStatus.CANCELLED]: 'Cancelled',
};

export const ALLOWED_CAMPAIGN_STATUS_TRANSITIONS: Record<CampaignStatus, CampaignStatus[]> = {
  [CampaignStatus.PLANNED]: [CampaignStatus.ACTIVE, CampaignStatus.CANCELLED],
  [CampaignStatus.ACTIVE]: [CampaignStatus.COMPLETED, CampaignStatus.CANCELLED],
  [CampaignStatus.COMPLETED]: [], // Terminal
  [CampaignStatus.CANCELLED]: [], // Terminal
};
