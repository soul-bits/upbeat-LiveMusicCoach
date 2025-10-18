import { greet, Calculator } from './index';

// Example usage
console.log(greet('TypeScript Developer'));

const calc = new Calculator();
console.log('5 + 3 =', calc.add(5, 3));
console.log('10 - 4 =', calc.subtract(10, 4));
console.log('6 * 7 =', calc.multiply(6, 7));
console.log('20 / 4 =', calc.divide(20, 4));
