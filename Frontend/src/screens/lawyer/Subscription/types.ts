export interface PlanItem {
  id: string;
  name: string;
  price: string;
  amount: number;
  popular?: boolean;
  features: string[];
}
