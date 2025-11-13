import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  InternalServerErrorException,
  Inject,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not } from 'typeorm';
import { Product, ProductStatus } from './entities/product.entity';
import { CreateProductDto, UpdateProductDto } from './dto';
import { Logger } from 'winston';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';

@Injectable()
export class ProductService {
  constructor(
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  async createProduct(userId: string, dto: CreateProductDto): Promise<Product> {
    const product = this.productRepository.create({
      ...dto,
      userId,
    });

    let savedProduct: Product;
    try {
      savedProduct = await this.productRepository.save(product);
    } catch (error) {
      this.logger.error('Failed to create product', { userId, error });
      throw new InternalServerErrorException('Failed to create product');
    }

    this.logger.info('Product created successfully', {
      productId: savedProduct.id,
      userId,
      title: savedProduct.title,
    });

    return savedProduct;
  }

  async getAllProducts(): Promise<Product[]> {
    return await this.productRepository.find({
      where: { status: Not(ProductStatus.DELETED) },
      order: { createdAt: 'DESC' },
    });
  }

  async getPublicProduct(productId: string): Promise<Product> {
    const product = await this.productRepository.findOne({
      where: {
        id: productId,
        status: ProductStatus.ACTIVE,
      },
    });

    if (!product || product.stock === 0) {
      this.logger.warn('Product not found or out of stock', { productId });
      throw new NotFoundException('Product not found or unavailable');
    }

    return product;
  }

  async getProductById(productId: string, userId: string): Promise<Product> {
    const product = await this.productRepository.findOne({
      where: {
        id: productId,
        status: Not(ProductStatus.DELETED),
      },
    });

    if (!product) {
      this.logger.warn('Product not found', { productId });
      throw new NotFoundException('Product not found');
    }

    if (product.userId !== userId) {
      this.logger.warn('User not authorized to access product', {
        productId,
        userId,
        ownerId: product.userId,
      });
      throw new ForbiddenException('You do not have access to this product');
    }

    return product;
  }

  async getMyProducts(userId: string): Promise<Product[]> {
    return await this.productRepository.find({
      where: {
        userId,
        status: Not(ProductStatus.DELETED),
      },
      order: { createdAt: 'DESC' },
    });
  }

  async updateProduct(userId: string, dto: UpdateProductDto): Promise<Product> {
    const product = await this.productRepository.findOne({
      where: {
        id: dto.productId,
        status: Not(ProductStatus.DELETED),
      },
    });

    if (!product) {
      this.logger.warn('Product not found for update', {
        productId: dto.productId,
      });
      throw new NotFoundException('Product not found');
    }

    if (product.userId !== userId) {
      this.logger.warn('User not authorized to update product', {
        productId: dto.productId,
        userId,
        ownerId: product.userId,
      });
      throw new ForbiddenException(
        'You do not have permission to update this product',
      );
    }

    // Prevent setting status to DELETED via update
    if (dto.status === ProductStatus.DELETED) {
      throw new BadRequestException(
        'Cannot set status to DELETED. Use delete endpoint instead',
      );
    }

    if (dto.title !== undefined) product.title = dto.title;
    if (dto.description !== undefined) product.description = dto.description;
    if (dto.price !== undefined) product.price = dto.price;
    if (dto.stock !== undefined) {
      product.stock = dto.stock;
      // Auto-update status based on stock (only if not manually overridden)
      if (dto.status === undefined) {
        if (dto.stock === 0 && product.status === ProductStatus.ACTIVE) {
          product.status = ProductStatus.OUT_OF_STOCK;
        } else if (
          dto.stock > 0 &&
          product.status === ProductStatus.OUT_OF_STOCK
        ) {
          product.status = ProductStatus.ACTIVE;
        }
      }
    }
    if (dto.status !== undefined) product.status = dto.status;

    let updatedProduct: Product;
    try {
      updatedProduct = await this.productRepository.save(product);
    } catch (error) {
      this.logger.error('Failed to update product', {
        productId: dto.productId,
        userId,
        error,
      });
      throw new InternalServerErrorException('Failed to update product');
    }

    this.logger.info('Product updated successfully', {
      productId: updatedProduct.id,
      userId,
      updatedFields: Object.keys(dto).filter((key) => key !== 'productId'),
    });

    return updatedProduct;
  }

  async deleteProduct(productId: string, userId: string): Promise<void> {
    const product = await this.productRepository.findOne({
      where: {
        id: productId,
        status: Not(ProductStatus.DELETED),
      },
    });

    if (!product) {
      this.logger.warn('Product not found for deletion', { productId });
      throw new NotFoundException('Product not found');
    }

    if (product.userId !== userId) {
      this.logger.warn('User not authorized to delete product', {
        productId,
        userId,
        ownerId: product.userId,
      });
      throw new ForbiddenException(
        'You do not have permission to delete this product',
      );
    }

    product.status = ProductStatus.DELETED;

    try {
      await this.productRepository.save(product);
    } catch (error) {
      this.logger.error('Failed to delete product', {
        productId,
        userId,
        error,
      });
      throw new InternalServerErrorException('Failed to delete product');
    }

    this.logger.info('Product deleted successfully', { productId, userId });
  }

  async getProductStatus(
    productId: string,
  ): Promise<{ status: ProductStatus; stock: number; isAvailable: boolean }> {
    const product = await this.productRepository.findOne({
      where: {
        id: productId,
        status: Not(ProductStatus.DELETED),
      },
    });

    if (!product) {
      this.logger.warn('Product not found for status check', { productId });
      throw new NotFoundException('Product not found');
    }

    return {
      status: product.status,
      stock: product.stock,
      isAvailable: product.status === ProductStatus.ACTIVE && product.stock > 0,
    };
  }
}
