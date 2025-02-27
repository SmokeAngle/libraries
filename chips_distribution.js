/**
 * 筹码分布算法
 * @param {Array.<Array.<string>>} kdata K图数据 [date,open,close,high,low,volume,amount,amplitude,turnover]
 * @param {number} [accuracyFactor=500] 精度因子
 * @param {number} [range] 计算范围
 * @param {number} [days] 计算交易天数
 */
function ChipsDistributionCalculator(kdata, accuracyFactor, range, days) {
    /**
     * K图数据
     */
    this.klinedata = kdata;
    /**
     * 精度因子(纵轴刻度数)
     */
    this.fator = accuracyFactor || 150;
    /**
     * 计算K线条数
     */
    this.range = range;
    /**
     * 计算筹码分布的交易天数
     */
    this.tradingdays = days;
}
/**
 * 计算分布及相关指标
 * @param {number} index 当前选中的K线的索引
 * @return {{x: Array.<number>, y: Array.<number>}}
 */
ChipsDistributionCalculator.prototype.calc = function (index) {
    let i;
    let maxprice = 0;
    let minprice = 1000000;
    /**
     * 计算N天的交易成本
     */
    const factor = this.fator;
    const end = index - this.range + 1;
    const start = end - this.tradingdays;
    /**
     * K图数据[
     */
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
    // 精度不小于0.01 产品逻辑
    const accuracy = Math.max(0.01, (maxprice - minprice) / (factor - 1));

    const currentprice = kdata[kdata_len-1].close;
    let boundary = -1;
    /**
     * 值域
     * @type {Array.<number>}
     */
    const yrange = [];
    for (i = 0; i < factor; i++) {
        const _price= (minprice + accuracy * i).toFixed(2) / 1;
        yrange.push(_price);
        if (boundary===-1 && _price >= currentprice) boundary = i;
    }
    /**
     * 横轴数据
     */
    const xdata = new Array(factor).fill(0);
    for (i = 0; i < kdata.length; i++) {
        const eles = kdata[i];
        const open = eles.open, close = eles.close, high = eles.high, low = eles.low,
            avg = (open + close + high + low) / 4, turnoverRate = Math.min(1, eles.turnover / 100 || 0);
        const H = Math.floor((high - minprice) / accuracy), L = Math.ceil((low - minprice) / accuracy),
            // G点坐标, 一字板时, X为进度因子
            GPoint = [high === low ? factor - 1 : 2 / (high - low), Math.floor((avg - minprice) / accuracy)];
        // 衰减
        for (let n = 0; n < xdata.length; n++) {
            xdata[n] *= (1 - turnoverRate);
        }
        if (high === low) {
            // 一字板时，画矩形面积是三角形的2倍
            xdata[GPoint[1]] += GPoint[0] * turnoverRate / 2;
        }
        else {
            for (let j = L; j <= H; j++) {
                const curprice = minprice + accuracy * j;
                if (curprice <= avg) {
                    // 上半三角叠加分布分布
                    if (Math.abs(avg - low) < 1e-8) {
                        xdata[j] += GPoint[0] * turnoverRate;
                    }
                    else {
                        xdata[j] += (curprice - low) / (avg - low) * GPoint[0] * turnoverRate;
                    }
                }
                else {
                    // 下半三角叠加分布分布
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
        //if (x < 0) xdata[i] = 0;
        totalChips += x;
    }
    const result = new CYQData();
    result.x = xdata;
    result.y = yrange;
    result.b = boundary + 1;
    result.d = kdata[kdata_len-1].date;
    result.t = this.tradingdays ;
    result.benefitPart = result.getBenefitPart(currentprice);
    result.avgCost = getCostByChip(totalChips * 0.5).toFixed(2);
    result.percentChips = {
        '90': result.computePercentChips(0.9),
        '70': result.computePercentChips(0.7)
    };
    return result;
    /**
     * 获取指定筹码处的成本
     * @param {number} chip 堆叠筹码
     */
    function getCostByChip(chip) {
        let result = 0, sum = 0;
        for (let i = 0; i < factor; i++) {
            const x = xdata[i].toPrecision(12) / 1;
            if (sum + x > chip) {
                result = minprice + i * accuracy;
                break;
            }
            sum += x;
        }
        return result;
    }
    /**
     * 筹码分布数据
     */
    function CYQData() {
        /**
         * 筹码堆叠
         * @type {Array.<number>}
         */
        this.x = arguments[0];
        /**
         * 价格分布
         * @type {Array.<number>}
         */
        this.y = arguments[1];
        /**
         * 获利比例
         * @type {number}
         */
        this.benefitPart = arguments[2];
        /**
         * 平均成本
         * @type {number}
         */
        this.avgCost = arguments[3];
        /**
         * 百分比筹码
         * @type {{Object.<string, {{priceRange: number[], concentration: number}}>}}
         */
        this.percentChips = arguments[4];
        /**
         * 筹码堆叠亏盈分界下标
         * @type {number}
         */
        this.b = arguments[5];
        /**
         * 交易日期
         * @type {number}
         */
        this.d = arguments[6];
        /**
         * 交易天数
         * @type {number}
         */
        this.t = arguments[7];
        /**
         * 计算指定百分比的筹码
         * @param {number} percent 百分比大于0，小于1
         */
        this.computePercentChips = function (percent) {
            if (percent > 1 || percent < 0)
                throw 'argument "percent" out of range';
            const ps = [(1 - percent) / 2, (1 + percent) / 2];
            const pr = [getCostByChip(totalChips * ps[0]), getCostByChip(totalChips * ps[1])];
            return {
                priceRange: [pr[0].toFixed(2), pr[1].toFixed(2)],
                concentration: pr[0] + pr[1] === 0 ? 0 : (pr[1] - pr[0]) / (pr[0] + pr[1])
            };
        };
        /**
         * 获取指定价格的获利比例
         * @param {number} price 价格
         */
        this.getBenefitPart = function (price) {
            let below = 0;
            for (let i = 0; i < factor; i++) {
                const x = xdata[i].toPrecision(12) / 1;
                if (price >= minprice + i * accuracy) {
                    below += x;
                }
            }
            return totalChips === 0 ? 0 : below / totalChips;
        };
    }
};