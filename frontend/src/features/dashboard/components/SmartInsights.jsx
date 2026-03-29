import { SpendForecast } from '../../../components/SpendForecast';
import { RecurringExpenses } from '../../../components/RecurringExpenses';

export function SmartInsights({ forecast, recurring, totalExpenses }) {
    const forecastVal = forecast ? forecast.predicted_total_expenses : 0;

    return (
        <>
            <div className="smart-grid">
                <div className="smart-col">
                    <SpendForecast
                        current={totalExpenses}
                        predicted={forecastVal}
                        recentParams={forecast?.based_on_months}
                    />
                </div>
                <div className="smart-col">
                    <RecurringExpenses items={recurring} />
                </div>
            </div>
        </>
    );
}
