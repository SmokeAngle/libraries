
class chipsDistributionData {
        constructor(_x, _y, _benefitPart, _avgCost, _percentChips, _b, _d, _t, _minprice, _accuracy, _factor, _totalChips) {
            this.x = _x;
            this.y = _y;
            this.benefitPart = _benefitPart;
            this.avgCost = _avgCost;
            this.percentChips = _percentChips;
            this.b = _b;
            this.d = _d;
            this.t = _t;
            this.minprice = _minprice;
            this.accuracy = _accuracy;
            this.factor = _factor;
            this.totalChips = _totalChips;
        }
        computePercentChips(percent) {
            if (percent > 1 || percent < 0)
                throw 'argument "percent" out of range';
            const ps = [(1 - percent) / 2, (1 + percent) / 2];
            const pr = [this.getCostByChip(this.totalChips * ps[0]), this.getCostByChip(this.totalChips * ps[1])];
            return {
                priceRange: [pr[0].toFixed(2), pr[1].toFixed(2)],
                concentration: pr[0] + pr[1] === 0 ? 0 : (pr[1] - pr[0]) / (pr[0] + pr[1])
            };
        }
        getBenefitPart(price) {
            let below = 0;
            for (let i = 0; i < this.factor; i++) {
                const x = this.x[i].toPrecision(12) / 1;
                if (price >= this.minprice + i * this.accuracy) {
                    below += x;
                }
            }
            return this.totalChips === 0 ? 0 : below / this.totalChips;
        }
        getCostByChip(chip) {
            let result = 0, sum = 0;
            for (let i = 0; i < this.factor; i++) {
                const x = this.x[i].toPrecision(12) / 1;
                if (sum + x > chip) {
                    result = this.minprice + i * this.accuracy;
                    break;
                }
                sum += x;
            }
            return result;
        }
}

class chipsDistributionCalculator {
    constructor(_kdata, _accuracyFactor, _range, _days) {
        this.klinedata = _kdata;
        this.fator = _accuracyFactor || 150;
        this.range = _range;
        this.tradingdays = _days;
    }

    calc(index) {
        let i;
        let maxprice = 0;
        let minprice = 1000000;

        const factor = this.fator;
        const end = index - this.range + 1;
        const start = end - this.tradingdays;

        let kdata = [];
        if (end===0){
            kdata = this.klinedata.slice(start);
        }else{
            kdata = this.klinedata.slice(start, end);
        }
        const kdata_len = kdata.length;
        for (i = 0; i < kdata_len; i++) {
            const elements = kdata[i];
            maxprice = Math.max(maxprice, elements.high);
            minprice = Math.min(minprice, elements.low);
        }

        const accuracy = Math.max(0.01, (maxprice - minprice) / (factor - 1));

        const currentprice = kdata[kdata_len-1].close;
        let boundary = -1;

        const yrange = [];
        for (i = 0; i < factor; i++) {
            const _price= (minprice + accuracy * i).toFixed(2) / 1;
            yrange.push(_price);
            if (boundary===-1 && _price >= currentprice) boundary = i;
        }

        const xdata = new Array(factor).fill(0);
        for (i = 0; i < kdata.length; i++) {
            const eles = kdata[i];
            const open = eles.open, close = eles.close, high = eles.high, low = eles.low,
                avg = (open + close + high + low) / 4, turnoverRate = Math.min(1, eles.turnover / 100 || 0);
            const H = Math.floor((high - minprice) / accuracy), L = Math.ceil((low - minprice) / accuracy),
                GPoint = [high === low ? factor - 1 : 2 / (high - low), Math.floor((avg - minprice) / accuracy)];

            for (let n = 0; n < xdata.length; n++) {
                xdata[n] *= (1 - turnoverRate);
            }
            if (high === low) {
                xdata[GPoint[1]] += GPoint[0] * turnoverRate / 2;
            }
            else {
                for (let j = L; j <= H; j++) {
                    const curprice = minprice + accuracy * j;
                    if (curprice <= avg) {
                        if (Math.abs(avg - low) < 1e-8) {
                            xdata[j] += GPoint[0] * turnoverRate;
                        }
                        else {
                            xdata[j] += (curprice - low) / (avg - low) * GPoint[0] * turnoverRate;
                        }
                    }
                    else {
                        if (Math.abs(high - avg) < 1e-8) {
                            xdata[j] += GPoint[0] * turnoverRate;
                        }
                        else {
                            xdata[j] += (high - curprice) / (high - avg) * GPoint[0] * turnoverRate;
                        }
                    }
                }
            }
        }
        let totalChips = 0;
        for (i = 0; i < factor; i++) {
            const x = xdata[i].toPrecision(12) / 1;
            totalChips += x;
        }
        const result = new chipsDistributionData();

        result.x = xdata;
        result.y = yrange;
        result.b = boundary + 1;
        result.d = kdata[kdata_len-1].date;
        result.t = this.tradingdays ;

        result.minprice = minprice;
        result.accuracy = accuracy;
        result.factor = factor;
        result.totalChips = totalChips;

        result.benefitPart = result.getBenefitPart(currentprice);
        result.avgCost = result.getCostByChip(totalChips * 0.5).toFixed(2);
        result.percentChips = {
            '90': result.computePercentChips(0.9),
            '70': result.computePercentChips(0.7)
        };

        return result;
    }
}