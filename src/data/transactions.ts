/**
 * Closed transactions, shown as a track record rather than as inventory.
 * These are NOT listings — several are buyer-side representations, and
 * presenting them in the listings feed would imply Kelly listed them.
 */
export type TransactionSide = "buyer" | "seller";

export type Transaction = {
  address: string;
  city: string;
  state: string;
  zip: string;
  /** Recorded sale price. */
  price: number;
  side: TransactionSide;
  beds?: number;
  baths?: number;
  sqft?: number;
  yearBuilt?: number;
  mlsId?: string;
  image?: string;
  /** One line on what made the deal worth showing. */
  note: string;
};

export const transactions: Transaction[] = [
  {
    address: "3554 W Townley Ave",
    city: "Phoenix",
    state: "AZ",
    zip: "85051",
    price: 450000,
    side: "buyer",
    beds: 4,
    baths: 3,
    sqft: 1691,
    yearBuilt: 1961,
    mlsId: "7046679",
    image: "/transactions/3554-w-townley-ave.jpg",
    note: "A remodeled three-bedroom main house plus an attached one-bedroom casita with its own entrance, bath and laundry — bought for a family who needed multigenerational space on a single lot.",
  },
  {
    address: "2029 N West St",
    city: "Flagstaff",
    state: "AZ",
    zip: "86004",
    price: 390000,
    side: "buyer",
    beds: 3,
    baths: 2,
    sqft: 1120,
    yearBuilt: 1991,
    mlsId: "7035266",
    image: "/transactions/2029-n-west-st.jpg",
    note: "A corner-lot home in Sunnyside Farms with an open floor plan and side-gate access — representation two hours north of the metro, in a market with very different inventory dynamics.",
  },
];

export const sideLabels: Record<TransactionSide, string> = {
  buyer: "Represented the buyer",
  seller: "Represented the seller",
};
