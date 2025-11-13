import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { ProductService } from './product.service';
import { GetCurrentUser, NoAuth } from '../common/decorators';
import { userReq } from '../common/types';
import { CreateProductDto, UpdateProductDto } from './dto';
import { Product, ProductStatus } from './entities/product.entity';

@ApiTags('products')
@Controller()
export class ProductController {
  constructor(private productService: ProductService) {}

  @ApiBearerAuth('JWT-auth')
  @Post('/product')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new product' })
  @ApiBody({ type: CreateProductDto })
  @ApiResponse({
    status: 201,
    description: 'Product created successfully',
    type: Product,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - validation error',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  async createProduct(
    @GetCurrentUser() user: userReq,
    @Body() dto: CreateProductDto,
  ): Promise<Product> {
    return await this.productService.createProduct(user.userId, dto);
  }

  @ApiBearerAuth('JWT-auth')
  @Put('/products/adjust')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update product data' })
  @ApiBody({ type: UpdateProductDto })
  @ApiResponse({
    status: 200,
    description: 'Product updated successfully',
    type: Product,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - validation error',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - not the product owner',
  })
  @ApiResponse({
    status: 404,
    description: 'Product not found',
  })
  async updateProduct(
    @GetCurrentUser() user: userReq,
    @Body() dto: UpdateProductDto,
  ): Promise<Product> {
    return await this.productService.updateProduct(user.userId, dto);
  }

  @NoAuth()
  @Get('/status/:productId')
  @ApiOperation({ summary: 'Get product status and availability' })
  @ApiParam({
    name: 'productId',
    description: 'Product ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Product status retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: Object.values(ProductStatus).filter(
            (s) => s !== ProductStatus.DELETED,
          ),
          example: ProductStatus.ACTIVE,
        },
        stock: {
          type: 'number',
          example: 50,
        },
        isAvailable: {
          type: 'boolean',
          example: true,
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Product not found',
  })
  async getProductStatus(
    @Param('productId') productId: string,
  ): Promise<{ status: ProductStatus; stock: number; isAvailable: boolean }> {
    return await this.productService.getProductStatus(productId);
  }

  @ApiBearerAuth('JWT-auth')
  @Get('/products')
  @ApiOperation({
    summary: 'List all active products (authenticated users)',
  })
  @ApiResponse({
    status: 200,
    description: 'Products list retrieved successfully',
    type: [Product],
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  async getAllProducts(): Promise<Product[]> {
    return await this.productService.getAllProducts();
  }

  @ApiBearerAuth('JWT-auth')
  @Get('/products/me')
  @ApiOperation({ summary: 'Get current user products' })
  @ApiResponse({
    status: 200,
    description: 'User products retrieved successfully',
    type: [Product],
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  async getMyProducts(@GetCurrentUser() user: userReq): Promise<Product[]> {
    return await this.productService.getMyProducts(user.userId);
  }

  @NoAuth()
  @Get('/products/:productId')
  @ApiOperation({
    summary: 'Get public product details (only active and in stock)',
  })
  @ApiParam({
    name: 'productId',
    description: 'Product ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Product retrieved successfully',
    type: Product,
  })
  @ApiResponse({
    status: 404,
    description: 'Product not found or unavailable',
  })
  async getPublicProduct(
    @Param('productId') productId: string,
  ): Promise<Product> {
    return await this.productService.getPublicProduct(productId);
  }

  @ApiBearerAuth('JWT-auth')
  @Get('/product/:productId')
  @ApiOperation({ summary: 'Get product by ID (owner only)' })
  @ApiParam({
    name: 'productId',
    description: 'Product ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Product retrieved successfully',
    type: Product,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - not the product owner',
  })
  @ApiResponse({
    status: 404,
    description: 'Product not found',
  })
  async getProductById(
    @GetCurrentUser() user: userReq,
    @Param('productId') productId: string,
  ): Promise<Product> {
    return await this.productService.getProductById(productId, user.userId);
  }

  @ApiBearerAuth('JWT-auth')
  @Delete('/products/:productId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete product (soft delete - sets status to DELETED)',
  })
  @ApiParam({
    name: 'productId',
    description: 'Product ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Product deleted successfully',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'Product deleted successfully',
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - not the product owner',
  })
  @ApiResponse({
    status: 404,
    description: 'Product not found',
  })
  async deleteProduct(
    @GetCurrentUser() user: userReq,
    @Param('productId') productId: string,
  ): Promise<{ message: string }> {
    await this.productService.deleteProduct(productId, user.userId);
    return { message: 'Product deleted successfully' };
  }
}
