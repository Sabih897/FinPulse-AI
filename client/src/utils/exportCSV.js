export const exportTransactionsToCSV = (transactions) => {
  if (!transactions || transactions.length === 0) return;

  const headers = ['Merchant,Amount,Category,Date,Type,Flagged,Flag Reason'];
  const rows = transactions.map((t) => [
    `"${t.merchant.replace(/"/g, '""')}"`,
    t.amount,
    `"${t.category}"`,
    `"${new Date(t.date).toISOString().split('T')[0]}"`,
    `"${t.type}"`,
    t.isFlagged ? 'Yes' : 'No',
    `"${(t.flagReason || '').replace(/"/g, '""')}"`
  ].join(','));

  const csvContent = [headers, ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `FinPulse_Export_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};