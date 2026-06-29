// ----------------------------------------------------
// Random crash multiplier
// ----------------------------------------------------

export function generateMultiplier() {

    const r = Math.random();

    let raw;

    if (r < 0.70) {

        raw = 1 + Math.random() * 2;

    } else if (r < 0.95) {

        raw = 3 + Math.random() * 17;

    } else {

        raw = 20 + Math.random() * 180;

    }

    return Math.max(
        1.01,
        Number((raw * 0.95).toFixed(2))
    );

}



// ----------------------------------------------------
// Duration of a round
// ----------------------------------------------------

export function roundDuration(multiplier) {

    return Math.ceil(

        (Math.log(multiplier) / 0.06) * 1000

    );

}



// ----------------------------------------------------
// Multiplier growth
// ----------------------------------------------------

export function calculateMultiplier(elapsed) {

    return Math.max(

        1,

        Math.exp(elapsed * 0.00006)

    );

}



// ----------------------------------------------------
// Currency formatter
// ----------------------------------------------------

export function formatMoney(amount) {

    return Number(amount || 0).toLocaleString(

        undefined,

        {

            minimumFractionDigits:2,

            maximumFractionDigits:2

        }

    );

}



// ----------------------------------------------------
// Clamp value
// ----------------------------------------------------

export function clamp(value,min,max){

    return Math.min(

        max,

        Math.max(min,value)

    );

}



// ----------------------------------------------------
// Timestamp
// ----------------------------------------------------

export function now(){

    return Date.now();

}