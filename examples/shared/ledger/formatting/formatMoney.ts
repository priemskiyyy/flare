const MONEY = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export const formatMoney = (amount: number) => MONEY.format(amount);
