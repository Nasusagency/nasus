export type NullableNumber = number | null;

export function sumKnown(values: NullableNumber[]): NullableNumber {
  const known = values.filter((value): value is number => value !== null);
  return known.length ? known.reduce((total, value) => total + value, 0) : null;
}

export function divideCost(numerator: NullableNumber, denominator: NullableNumber, multiplier = 1): NullableNumber {
  if (numerator === null || denominator === null || denominator <= 0) return null;
  return Math.round((numerator / denominator) * multiplier * 100) / 100;
}

export function calculateCampaignEfficiency(input: {
  spend: NullableNumber; impressions: NullableNumber; adClicks: NullableNumber;
  visits: NullableNumber; whatsappClicks: NullableNumber; conversations: NullableNumber;
  leads: NullableNumber; qualified: NullableNumber; highIntent: NullableNumber;
}) {
  return {
    cpc: divideCost(input.spend, input.adClicks),
    cpm: divideCost(input.spend, input.impressions, 1000),
    ctr: divideCost(input.adClicks, input.impressions, 100),
    costPerVisit: divideCost(input.spend, input.visits),
    costPerWhatsappClick: divideCost(input.spend, input.whatsappClicks),
    costPerConversation: divideCost(input.spend, input.conversations),
    costPerLead: divideCost(input.spend, input.leads),
    costPerQualified: divideCost(input.spend, input.qualified),
    costPerHighIntent: divideCost(input.spend, input.highIntent),
  };
}
