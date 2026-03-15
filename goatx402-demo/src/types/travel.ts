export type TripType = 'hotel' | 'flight' | 'train'
export type TripMode = 'one_way' | 'round_trip'

export interface TravelOption {
  id: string
  name: string
  price: number
  rating: number
  tripType: TripType
  details: string
}

import type { CalldataSignRequest } from 'goatx402-sdk'

export interface BookResponse {
  confirmation: string
  optionId: string
  tripType: TripType
  totalUsdt: string
  order: {
    orderId: string
    flow: string
    tokenSymbol: string
    tokenContract: string
    fromAddress: string
    payToAddress: string
    chainId: number
    amountWei: string
    expiresAt: number
    calldataSignRequest?: CalldataSignRequest
  }
}

export interface PaymentRecord {
  optionId: string
  amount: string
  txHash: string
  confirmedAt: string
}
