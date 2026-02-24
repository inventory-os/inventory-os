export interface LoanRecord {
  id: string
  assetId: string
  memberId: string
  assetName: string
  memberName: string
  borrowedAt: string
  dueAt: string | null
  returnedAt: string | null
}
