import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { OrderService } from './order.service';
import { GetCurrentUser, NoAuth } from '../common/decorators';
import { userReq } from '../common/types';
import { Order, OrderStatus } from './entities/order.entity';
import * as crypto from 'crypto';
import { ConfigService } from '@nestjs/config';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { Request } from 'express';

@ApiTags('orders')
@Controller('orders')
export class OrderController {
  constructor(
    private orderService: OrderService,
    private config: ConfigService,
  ) {}

  @ApiBearerAuth('JWT-auth')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new order' })
  @ApiBody({ type: CreateOrderDto })
  @ApiResponse({
    status: 201,
    description: 'Order created and checkout URL generated',
    schema: {
      type: 'object',
      properties: {
        checkoutUrl: {
          type: 'string',
          example: 'https://checkout.chapa.co/checkout/...',
        },
        txRef: {
          type: 'string',
          example: 'TX-1234567890',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - validation error or insufficient stock',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  @ApiResponse({
    status: 404,
    description: 'Product not found',
  })
  async createOrder(
    @GetCurrentUser() user: userReq,
    @Body() dto: CreateOrderDto,
  ): Promise<{ checkoutUrl: string; txRef: string }> {
    return await this.orderService.createOrder(dto, user.userId);
  }

  @NoAuth()
  @Post('/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify payment webhook from Chapa' })
  @ApiResponse({
    status: 200,
    description: 'Payment verified successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid signature or payment verification failed',
  })
  async verifyPayment(
    @Req() req: Request,
    @Headers('x-chapa-signature') chapaSignature: string,
  ) {
    try {
      // Validate the webhook signature
      const hash = crypto
        .createHmac('sha256', this.config.get<string>('CHAPA_WEBHOOK_SECRET'))
        .update(JSON.stringify(req['body']))
        .digest('hex');

      if (hash !== chapaSignature) {
        throw new BadRequestException('Invalid Chapa signature');
      }

      const { tx_ref } = req['body'];

      return await this.orderService.verifyPayment(tx_ref);
    } catch (err) {
      console.error('Webhook verification error:', err);
      throw err;
    }
  }

  @ApiBearerAuth('JWT-auth')
  @Get('/me')
  @ApiOperation({ summary: 'Get current user orders' })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: OrderStatus,
    description: 'Filter orders by status',
  })
  @ApiResponse({
    status: 200,
    description: 'User orders retrieved successfully',
    type: [Order],
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  async getMyOrders(
    @GetCurrentUser() user: userReq,
    @Query('status') status?: OrderStatus,
  ): Promise<Order[]> {
    return await this.orderService.getMyOrders(user.userId, status);
  }

  @ApiBearerAuth('JWT-auth')
  @Get('/my-products')
  @ApiOperation({
    summary: 'Get orders for products owned by current user',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: OrderStatus,
    description: 'Filter orders by status',
  })
  @ApiResponse({
    status: 200,
    description: 'Product orders retrieved successfully',
    type: [Order],
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  async getOrdersForMyProducts(
    @GetCurrentUser() user: userReq,
    @Query('status') status?: OrderStatus,
  ): Promise<Order[]> {
    return await this.orderService.getOrdersForMyProducts(user.userId, status);
  }

  @ApiBearerAuth('JWT-auth')
  @Get('/:orderId')
  @ApiOperation({ summary: 'Get order by ID' })
  @ApiParam({
    name: 'orderId',
    description: 'Order ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Order retrieved successfully',
    type: Order,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - not the buyer or product owner',
  })
  @ApiResponse({
    status: 404,
    description: 'Order not found',
  })
  async getOrderById(
    @GetCurrentUser() user: userReq,
    @Param('orderId') orderId: string,
  ): Promise<Order> {
    return await this.orderService.getOrderById(orderId, user.userId);
  }

  @ApiBearerAuth('JWT-auth')
  @Patch('/:orderId/status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update order status (product owner only)',
  })
  @ApiParam({
    name: 'orderId',
    description: 'Order ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiBody({ type: UpdateOrderStatusDto })
  @ApiResponse({
    status: 200,
    description: 'Order status updated successfully',
    type: Order,
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
    description: 'Order not found',
  })
  async updateOrderStatus(
    @GetCurrentUser() user: userReq,
    @Param('orderId') orderId: string,
    @Body() dto: UpdateOrderStatusDto,
  ): Promise<Order> {
    return await this.orderService.updateOrderStatus(orderId, user.userId, dto);
  }
}
