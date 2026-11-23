import type { Product } from '../domain/order';
import toast from '../../images/toast.jpg';
import sandwich from '../../images/egg_sandwich.jpg';
import soyMilk from '../../images/soy_milk.jpg';
import soyMilkThumbnail from '../../images/soy_milk.webp';
import bento from '../../images/bento.jpg';
import bentoThumbnail from '../../images/bento.webp';
import udon from '../../images/udon.jpg';
import curry from '../../images/curry_rice.jpg';
import milkTea from '../../images/milktea.jpg';
import blackTea from '../../images/black_tea.jpg';
import greenTea from '../../images/green_tea.jpg';
import cheesecake from '../../images/cheesecake.jpg';
import brownie from '../../images/brownie.jpg';
import brownieThumbnail from '../../images/brownie.webp';
import pudding from '../../images/pudding.jpg';
import puddingThumbnail from '../../images/pudding.webp';

const catalog: readonly Product[] = [
  { id: 'cheese-toast', name: '起司厚片', category: ['breakfast'], price: 60, image: toast, description: '酥脆吐司搭配香濃起司。' },
  { id: 'ham-egg-toast', name: '火腿蛋吐司', category: ['breakfast'], price: 55, image: sandwich, description: '經典早餐組合，一口滿足。' },
  { id: 'hot-soy-milk', name: '熱豆漿', category: ['breakfast', 'drink'], price: 45, image: soyMilk, thumbnail: soyMilkThumbnail, description: '暖胃順口的手工現煮豆漿。' },
  { id: 'home-bento', name: '家常便當', category: ['lunch'], price: 120, image: bento, thumbnail: bentoThumbnail, description: '三菜一肉，營養均衡。' },
  { id: 'pot-udon', name: '鍋燒烏龍麵', category: ['lunch'], price: 130, image: udon, description: '熱騰騰的湯頭配上 Q 彈烏龍麵。' },
  { id: 'curry-rice', name: '咖哩飯', category: ['lunch'], price: 110, image: curry, description: '濃郁日式咖哩配上白飯。' },
  { id: 'bubble-milk-tea', name: '珍珠奶茶', category: ['drink'], price: 45, image: milkTea, description: 'QQ 珍珠配上濃醇奶香。' },
  { id: 'black-tea', name: '古早味紅茶', category: ['drink'], price: 35, image: blackTea, description: '不會太甜的古早味好茶。' },
  { id: 'jasmine-green-tea', name: '茉莉綠茶', category: ['drink'], price: 40, image: greenTea, description: '清爽解膩的淡雅茶香。', soldOut: true },
  { id: 'cheesecake', name: '起司蛋糕', category: ['dessert'], price: 60, image: cheesecake, description: '綿密濃郁，入口即化。' },
  { id: 'chocolate-brownie', name: '巧克力布朗尼', category: ['dessert'], price: 50, image: brownie, thumbnail: brownieThumbnail, description: '濃厚巧克力，甜而不膩。' },
  { id: 'caramel-pudding', name: '焦糖布丁', category: ['dessert'], price: 45, image: pudding, thumbnail: puddingThumbnail, description: '滑嫩布丁搭配香甜焦糖。' },
];

export const products = catalog.filter(({ price }) => Number.isSafeInteger(price) && price > 0);
export const productsById = new Map(products.map(product => [product.id, product]));
