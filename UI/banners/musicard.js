import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const data = {
    backgroundImages: [
        path.resolve(__dirname, '../musicimages/1.png'),
        path.resolve(__dirname, '../musicimages/2.jpg'),
        path.resolve(__dirname, '../musicimages/3.jpg'),
        path.resolve(__dirname, '../musicimages/4.jpg'),
        path.resolve(__dirname, '../musicimages/5.jpg'),
    ],
};

export default data;
